"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { 
    Clock, Check, GripVertical, Settings, Bell, 
    UtensilsCrossed, ListTodo, Package, Users, Plus,
    BarChart3, IndianRupee, TrendingUp, Edit3, Trash2, Save, X, Image as ImageIcon, Info, Leaf, Flame, Star,
    Upload, Link as LinkIcon
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import Link from 'next/link';
import { polyfill } from "mobile-drag-drop";
import { scrollBehaviourDragImageTranslateOverride } from "mobile-drag-drop/scroll-behaviour";
import { useRouter } from "next/navigation";
import { collection, onSnapshot, doc, updateDoc, setDoc, deleteDoc, Timestamp, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";

const DEFAULT_MENU: MenuItem[] = [
    { id: "burger1", name: "Classic Gourmet Burger", category: "Mains", price: 15.99, available: true, image: "/images/burger.png", description: "Premium beef patty, aged cheddar, fresh lettuce, secret sauce on a brioche bun.", spiceLevel: 0, isVegetarian: false, rating: 4.8, reviews: 128 },
    { id: "pizza1", name: "Margherita Pizza", category: "Mains", price: 18.50, available: true, image: "/images/pizza.png", description: "San Marzano tomato sauce, fresh mozzarella, basil, and extra virgin olive oil.", spiceLevel: 0, isVegetarian: true, rating: 4.9, reviews: 84 },
    { id: "salad1", name: "Caesar Salad", category: "Starters", price: 12.00, available: true, image: "/images/salad.png", description: "Crisp romaine, parmesan cheese, house-made croutons, signature garlic dressing.", spiceLevel: 0, isVegetarian: true, rating: 4.5, reviews: 56 },
    { id: "coffee1", name: "Signature Iced Coffee", category: "Drinks", price: 5.50, available: true, image: "/images/coffee.png", description: "Cold brew coffee, vanilla bean syrup, fresh milk swirl, served over ice.", spiceLevel: 0, isVegetarian: true, rating: 4.7, reviews: 212 },
    { id: "spicy_wings", name: "Inferno Wings (6pcs)", category: "Starters", price: 10.99, available: true, image: "/images/wings.png", description: "Crispy chicken wings tossed in our signature blazing hot pepper sauce.", spiceLevel: 3, isVegetarian: false, rating: 4.6, reviews: 95 },
    { id: "tiramisu", name: "Classic Tiramisu", category: "Desserts", price: 8.50, available: true, image: "/images/tiramisu.png", description: "Espresso-soaked ladyfingers layered with mascarpone cream.", spiceLevel: 0, isVegetarian: true, rating: 4.9, reviews: 156 },
];

// Types
type OrderStatus = "received" | "cooking" | "ready" | "partially_delivered" | "delivered" | "delayed" | "cancelled";
type ItemCategory = "Starters" | "Mains" | "Drinks" | "Desserts" | "other";

interface OrderItem {
    id: string;
    name: string;
    qty: number;
    price: number;
    notes?: string;
    done?: boolean; // Checklist for delivery
    status: OrderStatus;
    category: ItemCategory;
}

interface Order {
    id: string;
    table: string;
    items: OrderItem[];
    createdAt: Date;
    status: OrderStatus; // Overall order status
}

interface MenuItem {
    id: string;
    name: string;
    category: ItemCategory;
    price: number;
    available: boolean;
    image: string;
    description: string;
    spiceLevel: number;
    isVegetarian: boolean;
    rating?: number;
    reviews?: number;
}

export default function OwnerDashboard() {
    const router = useRouter();
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isAuthChecking, setIsAuthChecking] = useState(true);
    
    const [activeTab, setActiveTab] = useState<"orders" | "analytics" | "menu">("orders");

    useEffect(() => {
        if (typeof window !== 'undefined') {
            if (localStorage.getItem('owner_auth') === 'true') {
                setIsAuthenticated(true);
            } else {
                router.push("/");
            }
            setIsAuthChecking(false);
        }
    }, [router]);

    // Polyfill for drag-and-drop
    useEffect(() => {
        if (typeof window !== "undefined") {
            polyfill({
                dragImageTranslateOverride: scrollBehaviourDragImageTranslateOverride
            });
            window.addEventListener('touchmove', function () { }, { passive: false });
        }
    }, []);

    // Initial State
    const [orders, setOrders] = useState<Order[]>([]);
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [dragHover, setDragHover] = useState<OrderStatus | null>(null);

    // Firestore real-time listeners (start only once authenticated)
    useEffect(() => {
        if (!isAuthenticated) return;
        const unsubOrders = onSnapshot(collection(db, "orders"), (snap) => {
            const docs = snap.docs.map(d => {
                const data = d.data();
                return {
                    id: d.id,
                    table: data.tableId ?? data.table ?? "",
                    status: data.status as OrderStatus,
                    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
                    items: (data.items ?? []).map((i: OrderItem) => ({ ...i, done: i.done ?? false })),
                } as Order;
            });
            setOrders(docs);
        });
        const unsubMenu = onSnapshot(collection(db, "inventory"), (snap) => {
            const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as MenuItem));
            setMenuItems(docs);
        });
        return () => { unsubOrders(); unsubMenu(); };
    }, [isAuthenticated]);

    const handleLogout = () => {
        localStorage.removeItem('owner_auth');
        setIsAuthenticated(false);
        router.push("/");
    };

    // --- Order Management Methods ---

    const handleDragStartOrder = (e: React.DragEvent | React.TouchEvent, orderId: string, sourceStatus: OrderStatus) => {
        if ('dataTransfer' in e) {
            e.dataTransfer.setData('application/json', JSON.stringify({ type: 'order', orderId, sourceStatus }));
            e.dataTransfer.effectAllowed = 'move';
        }
    };

    const handleDrop = (e: React.DragEvent, targetStatus: OrderStatus) => {
        e.preventDefault();
        setDragHover(null);
        try {
            const data = JSON.parse(e.dataTransfer.getData('application/json'));
            if (data.type === 'order') {
                updateOrderStatus(data.orderId, targetStatus);
            }
        } catch (err) {
            console.error("Drop Parse Error", err);
        }
    };

    const updateOrderStatus = async (orderId: string, newStatus: OrderStatus) => {
        const order = orders.find(o => o.id === orderId);
        if (!order) return;
        let itemStatus = newStatus as OrderStatus;
        if (newStatus === "partially_delivered") itemStatus = "ready";
        const updatedItems = order.items.map(i => ({ ...i, status: itemStatus }));
        await updateDoc(doc(db, "orders", orderId), { status: newStatus, items: updatedItems });
        toast.success(`Order #${orderId} moved to ${newStatus.replace('_', ' ')}`);
    };

    const toggleItemDeliveryCheck = async (orderId: string, itemId: string) => {
        const order = orders.find(o => o.id === orderId);
        if (!order) return;
        const updatedItems = order.items.map(i => i.id === itemId ? { ...i, done: !i.done } : i);
        await updateDoc(doc(db, "orders", orderId), { items: updatedItems });
    };

    const getOrdersForStatus = (status: OrderStatus) => {
        return orders.filter(o => o.status === status).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    };

    // --- Menu Management Methods ---
    const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
    const [imageUploading, setImageUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImageFile = useCallback((file: File) => {
        if (!file.type.startsWith('image/')) return;
        setImageUploading(true);
        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target?.result as string;
            setEditingItem(prev => prev ? { ...prev, image: dataUrl } : prev);
            setImageUploading(false);
        };
        reader.readAsDataURL(file);
    }, []);

    const handleImagePaste = useCallback((e: React.ClipboardEvent) => {
        const file = Array.from(e.clipboardData.items)
            .find(item => item.type.startsWith('image/'))?.getAsFile();
        if (file) handleImageFile(file);
    }, [handleImageFile]);

    const handleSaveMenuItem = async (item: MenuItem) => {
        const docId = item.id || `m${Date.now()}`;
        const payload = { ...item, id: docId, rating: item.rating ?? 0, reviews: item.reviews ?? 0 };
        await setDoc(doc(db, "inventory", docId), payload);
        setEditingItem(null);
        toast.success("Menu updated successfully!");
    };

    const handleDeleteMenuItem = async (id: string) => {
        await deleteDoc(doc(db, "inventory", id));
        toast.success("Item removed from menu.");
    };

    const toggleItemAvailability = async (id: string) => {
        const item = menuItems.find(i => i.id === id);
        if (!item) return;
        await updateDoc(doc(db, "inventory", id), { available: !item.available });
    };

    const seedDefaultMenu = async () => {
        const batch = writeBatch(db);
        DEFAULT_MENU.forEach(item => batch.set(doc(db, "inventory", item.id), item));
        await batch.commit();
        toast.success("Default menu seeded to Firestore!");
    };

    // --- Analytics Methods ---
    const getTotalRevenue = () => {
        return orders.reduce((sum, order) => {
            if (order.status !== 'cancelled') {
                return sum + order.items.reduce((itemSum, item) => itemSum + (item.price * item.qty), 0);
            }
            return sum;
        }, 0);
    };

    const getPopularItems = () => {
        const counts: Record<string, { name: string, qty: number }> = {};
        orders.forEach(o => {
            if (o.status !== 'cancelled') {
                o.items.forEach(i => {
                    if (!counts[i.name]) counts[i.name] = { name: i.name, qty: 0 };
                    counts[i.name].qty += i.qty;
                });
            }
        });
        return Object.values(counts).sort((a, b) => b.qty - a.qty).slice(0, 5);
    };

    if (isAuthChecking) return <div className="min-h-screen bg-neutral-50 flex items-center justify-center"><div className="w-10 h-10 border-4 border-neutral-200 border-t-neutral-800 rounded-full animate-spin"></div></div>;
    if (!isAuthenticated) return null;

    // Render components
    const renderKanbanColumn = (status: OrderStatus, title: string, badgeColor: string) => {
        const columnOrders = getOrdersForStatus(status);

        return (
            <div
                className="flex-shrink-0 w-80 lg:w-96 flex flex-col bg-neutral-100/50 rounded-2xl border border-transparent"
            >
                <div className="p-4 flex items-center justify-between sticky top-0 z-10 rounded-t-2xl">
                    <h3 className="font-semibold text-neutral-800 flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${badgeColor}`}></span>
                        {title}
                    </h3>
                    <div className="text-xs font-medium bg-white text-neutral-600 px-2.5 py-1 rounded-full shadow-sm border border-neutral-200">{columnOrders.length}</div>
                </div>
                <div className="flex-1 overflow-y-auto p-3 pt-0 flex flex-col gap-3 min-h-0 relative">
                    {columnOrders.map(order => (
                        <div
                            key={order.id}
                            className="bg-white border border-neutral-200 rounded-xl p-4 shadow-sm"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <div className="text-lg font-bold text-neutral-900 tracking-tight font-mono">{order.id}</div>
                                    <div className="text-sm text-neutral-500 font-medium">Table {order.table}</div>
                                </div>
                                <div className="text-xs text-neutral-400 font-medium flex items-center gap-1.5 bg-neutral-50 px-2 py-1 rounded-md border border-neutral-100">
                                    <Clock className="w-3.5 h-3.5" />
                                    {Math.floor((Date.now() - order.createdAt.getTime()) / 60000)}m
                                </div>
                            </div>
                            <div className="space-y-2.5 pt-3 border-t border-neutral-100">
                                {order.items.map(item => (
                                    <div key={item.id} className="flex items-start gap-2">
                                        <div className={`mt-0.5 shrink-0 w-5 h-5 rounded flex items-center justify-center border ${
                                            item.done ? 'bg-neutral-900 border-neutral-900 text-white' : 'border-neutral-200 bg-neutral-50'
                                        }`}>
                                            {item.done && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
                                        </div>
                                        <div className="flex-1 leading-tight pt-0.5">
                                            <div className={`text-sm ${item.done ? 'line-through text-neutral-400' : 'text-neutral-700'}`}>
                                                <span className="font-semibold text-neutral-900">{item.qty}x</span> {item.name}
                                            </div>
                                            {item.notes && <div className="text-xs font-medium text-amber-600 mt-1.5 bg-amber-50 inline-block px-1.5 py-0.5 rounded border border-amber-100">Note: {item.notes}</div>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                    {columnOrders.length === 0 && (
                        <div className="h-24 border-2 border-dashed border-neutral-200 bg-neutral-50/50 rounded-xl flex flex-col items-center justify-center text-neutral-400 text-sm font-medium mt-2">
                            No Orders
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="h-[100dvh] flex bg-neutral-50 text-neutral-900 overflow-hidden font-sans selection:bg-neutral-200 selection:text-neutral-900">
            <Toaster position="top-right" />
            
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r border-neutral-200 flex flex-col hidden md:flex shrink-0">
                <div className="h-16 flex items-center px-6 border-b border-neutral-100">
                    <div className="w-8 h-8 bg-neutral-900 text-white flex items-center justify-center font-serif italic text-xl rounded-lg shadow-sm">R</div>
                    <h1 className="text-lg font-bold ml-3 tracking-tight">
                        Resper
                    </h1>
                </div>

                <div className="p-4 flex-1 flex flex-col gap-1">
                    <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2 mt-2 px-3">Management</div>
                    
                    <button 
                        onClick={() => setActiveTab('orders')}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium ${activeTab === 'orders' ? 'bg-neutral-100 text-neutral-900' : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'}`}
                    >
                        <ListTodo className="w-4 h-4" /> Live Orders
                    </button>
                    <button 
                        onClick={() => setActiveTab('menu')}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium ${activeTab === 'menu' ? 'bg-neutral-100 text-neutral-900' : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'}`}
                    >
                        <UtensilsCrossed className="w-4 h-4" /> Menu Content
                    </button>
                    <button 
                        onClick={() => setActiveTab('analytics')}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium ${activeTab === 'analytics' ? 'bg-neutral-100 text-neutral-900' : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'}`}
                    >
                        <BarChart3 className="w-4 h-4" /> Insights
                    </button>
                </div>

                <div className="p-4 border-t border-neutral-100">
                    <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium text-neutral-600 hover:bg-neutral-100 w-full">
                        <Settings className="w-4 h-4" /> Sign Out
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
                
                {/* Mobile Header */}
                <header className="h-16 bg-white border-b border-neutral-200 flex items-center justify-between px-4 md:hidden shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-7 h-7 bg-neutral-900 text-white flex items-center justify-center font-serif italic text-lg rounded-md">R</div>
                        <h1 className="text-base font-bold tracking-tight">Resper</h1>
                    </div>
                    <select 
                        value={activeTab}
                        onChange={(e) => setActiveTab(e.target.value as any)}
                        className="bg-neutral-50 border border-neutral-200 rounded-md px-3 py-1.5 text-sm font-medium"
                    >
                        <option value="orders">Orders</option>
                        <option value="menu">Menu</option>
                        <option value="analytics">Analytics</option>
                    </select>
                </header>

                {/* 1. ORDERS KANBAN VIEW */}
                {activeTab === 'orders' && (
                    <div className="h-full flex flex-col bg-[#FAFAFA]">
                        <div className="h-16 px-6 flex items-center justify-between border-b border-neutral-200 bg-white shrink-0">
                            <h2 className="text-xl font-semibold tracking-tight text-neutral-800">Live Orders</h2>
                            <div className="flex items-center gap-2">
                                <span className="relative flex h-2.5 w-2.5">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                                </span>
                                <span className="text-sm font-medium text-neutral-500">Sync Active</span>
                            </div>
                        </div>
                        <div className="flex-1 overflow-x-auto no-scrollbar p-6 snap-x flex gap-6 items-start">
                            {renderKanbanColumn("received", "New", "bg-blue-500")}
                            {renderKanbanColumn("cooking", "Preparing", "bg-amber-500")}
                            {renderKanbanColumn("ready", "Ready for Pickup", "bg-emerald-500")}
                            {renderKanbanColumn("partially_delivered", "Partial Delivery", "bg-purple-500")}
                            {renderKanbanColumn("delivered", "Completed", "bg-neutral-400")}
                            {renderKanbanColumn("delayed", "Delayed", "bg-red-500")}
                            {renderKanbanColumn("cancelled", "Cancelled", "bg-neutral-300")}
                        </div>
                    </div>
                )}

                {/* 2. MENU & INVENTORY MANAGEMENT */}
                {activeTab === 'menu' && (
                    <div className="h-full overflow-y-auto bg-[#FAFAFA]">
                        <div className="bg-white border-b border-neutral-200 px-8 py-8 sticky top-0 z-10">
                            <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div>
                                    <h2 className="text-2xl font-bold tracking-tight text-neutral-900">Menu Content</h2>
                                    <p className="text-neutral-500 mt-1 text-sm">Manage item details, photography, and availability</p>
                                </div>
                                <button 
                                    onClick={() => setEditingItem({ id: '', name: '', category: 'Mains', price: 0, available: true, image: '', description: '', spiceLevel: 0, isVegetarian: false })}
                                    className="bg-neutral-900 text-white px-4 py-2.5 rounded-lg font-medium text-sm flex items-center gap-2 hover:bg-neutral-800 transition-colors shadow-sm w-fit"
                                >
                                    <Plus className="w-4 h-4" /> Add New Item
                                </button>
                            </div>
                        </div>

                        <div className="max-w-6xl mx-auto p-8">
                            {menuItems.length === 0 && (
                                <div className="text-center py-16 border-2 border-dashed border-neutral-200 rounded-2xl mb-8">
                                    <p className="text-neutral-400 mb-4 font-medium">No menu items in Firestore yet.</p>
                                    <button
                                        onClick={seedDefaultMenu}
                                        className="bg-neutral-900 text-white px-6 py-2.5 rounded-lg font-medium text-sm hover:bg-neutral-800 transition-colors"
                                    >
                                        Seed Default Menu
                                    </button>
                                </div>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                {menuItems.map(item => (
                                    <div key={item.id} className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden flex flex-col group hover:shadow-md transition-all duration-300">
                                        {/* Image Header */}
                                        <div className="h-40 bg-neutral-100 relative overflow-hidden flex items-center justify-center">
                                            {item.image ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                            ) : (
                                                <ImageIcon className="w-8 h-8 text-neutral-300" />
                                            )}
                                            
                                            <div className="absolute top-3 right-3 flex gap-2">
                                                {!item.available && (
                                                    <span className="bg-white/90 backdrop-blur text-neutral-900 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded shadow-sm">
                                                        Sold Out
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="p-5 flex-1 flex flex-col">
                                            <div className="flex justify-between items-start mb-2">
                                                <h3 className="text-lg font-serif font-bold text-neutral-900 leading-tight">{item.name}</h3>
                                                <span className="text-lg font-medium text-neutral-900">₹{item.price.toFixed(2)}</span>
                                            </div>
                                            
                                            <p className="text-sm text-neutral-500 line-clamp-2 mb-4 leading-relaxed">
                                                {item.description || "No description provided."}
                                            </p>

                                            {/* Badges */}
                                            <div className="flex items-center gap-3 mt-auto pt-4 border-t border-neutral-100">
                                                <span className="text-xs font-medium bg-neutral-100 text-neutral-600 px-2 py-1 rounded-md">
                                                    {item.category}
                                                </span>
                                                {item.isVegetarian && (
                                                    <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">
                                                        <Leaf className="w-3 h-3" /> Veg
                                                    </span>
                                                )}
                                                {item.spiceLevel > 0 && (
                                                    <span className="flex items-center gap-1 text-xs font-medium text-rose-600 bg-rose-50 px-2 py-1 rounded-md">
                                                        <Flame className="w-3 h-3" /> {item.spiceLevel}/5
                                                    </span>
                                                )}
                                                <div className="ml-auto flex gap-2">
                                                    <button onClick={() => setEditingItem(item)} className="p-1.5 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-md transition-colors" title="Edit Item">
                                                        <Edit3 className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => handleDeleteMenuItem(item.id)} className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors" title="Delete Item">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* 3. ANALYTICS */}
                {activeTab === 'analytics' && (
                    <div className="h-full overflow-y-auto bg-[#FAFAFA] p-8">
                        <div className="max-w-6xl mx-auto">
                            <div className="mb-8">
                                <h2 className="text-2xl font-bold tracking-tight text-neutral-900">Performance Insights</h2>
                                <p className="text-neutral-500 mt-1 text-sm">Real-time metrics for today</p>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                                <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm">
                                    <div className="flex items-center gap-3 text-neutral-500 font-medium text-sm mb-4">
                                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><IndianRupee className="w-5 h-5" /></div>
                                        Total Revenue
                                    </div>
                                    <div className="text-4xl font-bold tracking-tight text-neutral-900">₹{getTotalRevenue().toFixed(2)}</div>
                                </div>
                                <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm">
                                    <div className="flex items-center gap-3 text-neutral-500 font-medium text-sm mb-4">
                                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><ListTodo className="w-5 h-5" /></div>
                                        Total Orders
                                    </div>
                                    <div className="text-4xl font-bold tracking-tight text-neutral-900">{orders.length}</div>
                                </div>
                                <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm">
                                    <div className="flex items-center gap-3 text-neutral-500 font-medium text-sm mb-4">
                                        <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><TrendingUp className="w-5 h-5" /></div>
                                        Avg Ticket Size
                                    </div>
                                    <div className="text-4xl font-bold tracking-tight text-neutral-900">
                                        ₹{orders.length ? (getTotalRevenue() / orders.length).toFixed(2) : '0.00'}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div className="border border-neutral-200 bg-white rounded-2xl p-6 shadow-sm">
                                    <h3 className="font-bold text-neutral-900 mb-6 flex items-center gap-2">
                                        <Package className="w-5 h-5 text-neutral-400" /> Popular Items
                                    </h3>
                                    <div className="space-y-4">
                                        {getPopularItems().map((item, idx) => (
                                            <div key={idx} className="flex items-center justify-between pb-4 border-b border-neutral-100 last:border-0 last:pb-0">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-8 h-8 rounded-full bg-neutral-50 flex items-center justify-center font-bold text-neutral-500 text-sm">{idx + 1}</div>
                                                    <span className="font-medium text-neutral-900">{item.name}</span>
                                                </div>
                                                <div className="font-medium text-neutral-900 bg-neutral-50 px-3 py-1 rounded-lg text-sm">{item.qty} sold</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="border border-neutral-200 bg-white rounded-2xl p-8 shadow-sm flex flex-col items-center justify-center text-center">
                                    <BarChart3 className="w-12 h-12 text-neutral-300 mb-4" />
                                    <h3 className="text-neutral-900 font-bold mb-2">Connect Integrations</h3>
                                    <p className="text-neutral-500 text-sm max-w-sm leading-relaxed">Connect to Stripe or Square to unlock historical trends, deeper financial insights, and automated tax reporting.</p>
                                    <button className="mt-6 border border-neutral-200 bg-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-neutral-50 transition-colors shadow-sm">
                                        View Connections
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>

            {/* Menu Item Edit Modal */}
            {editingItem && (
                <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl relative animate-in slide-in-from-bottom-4 duration-300 max-h-[90vh] flex flex-col">
                        
                        <div className="flex items-center justify-between p-6 border-b border-neutral-100 shrink-0">
                            <h3 className="text-xl font-bold tracking-tight text-neutral-900">{editingItem.id ? 'Edit Menu Item' : 'Create Menu Item'}</h3>
                            <button onClick={() => setEditingItem(null)} className="text-neutral-400 hover:text-neutral-600 transition-colors bg-neutral-50 hover:bg-neutral-100 p-2 rounded-full">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto flex-1">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                
                                {/* Left Column: Basic Info */}
                                <div className="space-y-5">
                                    <div>
                                        <label className="block text-sm font-semibold text-neutral-700 mb-1.5">Item Name</label>
                                        <input 
                                            type="text" 
                                            value={editingItem.name}
                                            onChange={e => setEditingItem({...editingItem, name: e.target.value})}
                                            className="w-full bg-white border border-neutral-300 rounded-lg px-4 py-2.5 text-neutral-900 focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 transition-all outline-none"
                                            placeholder="e.g. Classic Gourmet Burger"
                                            autoFocus
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-semibold text-neutral-700 mb-1.5">Price (₹)</label>
                                            <input 
                                                type="number" 
                                                value={editingItem.price}
                                                onChange={e => setEditingItem({...editingItem, price: parseFloat(e.target.value) || 0})}
                                                className="w-full bg-white border border-neutral-300 rounded-lg px-4 py-2.5 text-neutral-900 focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 transition-all outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-neutral-700 mb-1.5">Category</label>
                                            <select 
                                                value={editingItem.category}
                                                onChange={e => setEditingItem({...editingItem, category: e.target.value as ItemCategory})}
                                                className="w-full bg-white border border-neutral-300 rounded-lg px-4 py-2.5 text-neutral-900 focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 transition-all outline-none appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23666%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_12px_center] bg-[length:16px]"
                                            >
                                                <option value="Starters">Starters</option>
                                                <option value="Mains">Mains</option>
                                                <option value="Drinks">Drinks</option>
                                                <option value="Desserts">Desserts</option>
                                                <option value="other">Other</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-neutral-700 mb-1.5">Description</label>
                                        <textarea 
                                            value={editingItem.description}
                                            onChange={e => setEditingItem({...editingItem, description: e.target.value})}
                                            className="w-full bg-white border border-neutral-300 rounded-lg px-4 py-3 text-neutral-900 focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 transition-all outline-none min-h-[100px] resize-none"
                                            placeholder="Write a mouth-watering description..."
                                        />
                                    </div>
                                </div>

                                {/* Right Column: Media & Meta */}
                                <div className="space-y-5">
                                    <div>
                                        <label className="block text-sm font-semibold text-neutral-700 mb-2">Item Image</label>

                                        {/* Drop / paste zone */}
                                        <div
                                            className="relative h-36 bg-neutral-50 rounded-xl border-2 border-dashed border-neutral-300 overflow-hidden flex items-center justify-center cursor-pointer hover:border-neutral-500 transition-colors mb-2"
                                            onClick={() => fileInputRef.current?.click()}
                                            onPaste={handleImagePaste}
                                            onDragOver={e => e.preventDefault()}
                                            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleImageFile(f); }}
                                            tabIndex={0}
                                            onKeyDown={e => e.key === 'Enter' && fileInputRef.current?.click()}
                                        >
                                            {imageUploading ? (
                                                <div className="flex flex-col items-center text-neutral-400">
                                                    <div className="w-5 h-5 border-2 border-neutral-300 border-t-neutral-600 rounded-full animate-spin mb-2" />
                                                    <span className="text-xs">Loading…</span>
                                                </div>
                                            ) : editingItem.image ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img src={editingItem.image} alt="Preview" className="h-full w-full object-cover" />
                                            ) : (
                                                <div className="flex flex-col items-center text-neutral-400 pointer-events-none">
                                                    <Upload className="w-6 h-6 mb-1" />
                                                    <span className="text-xs font-medium">Click to upload or drag & drop</span>
                                                    <span className="text-[11px] mt-0.5">You can also paste (Ctrl+V) an image here</span>
                                                </div>
                                            )}
                                            {editingItem.image && (
                                                <button
                                                    type="button"
                                                    onClick={e => { e.stopPropagation(); setEditingItem({...editingItem, image: ''}); }}
                                                    className="absolute top-1.5 right-1.5 bg-neutral-900/70 hover:bg-neutral-900 text-white rounded-full p-1 transition-colors"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            )}
                                        </div>

                                        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleImageFile(f); e.target.value = ''; }} />

                                        {/* URL fallback */}
                                        <div className="flex items-center gap-2 mt-2">
                                            <LinkIcon className="w-4 h-4 text-neutral-400 shrink-0" />
                                            <input
                                                type="text"
                                                value={editingItem.image.startsWith('data:') ? '' : editingItem.image}
                                                onChange={e => setEditingItem({...editingItem, image: e.target.value})}
                                                className="w-full bg-white border border-neutral-300 rounded-lg px-3 py-2 text-sm text-neutral-900 focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 transition-all outline-none"
                                                placeholder="Or paste a URL…"
                                            />
                                        </div>
                                    </div>

                                    <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-200 space-y-4">
                                        <h4 className="text-sm font-bold text-neutral-900">Dietary & Attributes</h4>
                                        
                                        <label className="flex items-center justify-between cursor-pointer">
                                            <div className="flex items-center gap-2">
                                                <Leaf className="w-4 h-4 text-emerald-600" />
                                                <span className="text-sm font-medium text-neutral-700">Vegetarian</span>
                                            </div>
                                            <input 
                                                type="checkbox" 
                                                checked={editingItem.isVegetarian}
                                                onChange={e => setEditingItem({...editingItem, isVegetarian: e.target.checked})}
                                                className="w-4 h-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900"
                                            />
                                        </label>

                                        <div>
                                            <div className="flex items-center gap-2 mb-2">
                                                <Flame className="w-4 h-4 text-rose-500" />
                                                <span className="text-sm font-medium text-neutral-700">Spice Level ({editingItem.spiceLevel}/5)</span>
                                            </div>
                                            <input 
                                                type="range" 
                                                min="0" max="5" 
                                                value={editingItem.spiceLevel}
                                                onChange={e => setEditingItem({...editingItem, spiceLevel: parseInt(e.target.value)})}
                                                className="w-full accent-neutral-900"
                                            />
                                        </div>
                                    </div>

                                    <label className="flex items-center justify-between p-4 bg-white border border-neutral-200 rounded-xl cursor-pointer">
                                        <span className="text-sm font-bold text-neutral-900">Available to Order</span>
                                        <input 
                                            type="checkbox" 
                                            checked={editingItem.available}
                                            onChange={e => setEditingItem({...editingItem, available: e.target.checked})}
                                            className="w-4 h-4 rounded border-neutral-300 text-emerald-600 focus:ring-emerald-600"
                                        />
                                    </label>
                                </div>

                            </div>
                        </div>

                        <div className="p-6 border-t border-neutral-100 flex justify-end gap-3 shrink-0 bg-neutral-50/50 rounded-b-2xl">
                            <button 
                                onClick={() => setEditingItem(null)}
                                className="px-5 py-2.5 text-sm font-medium text-neutral-600 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={() => handleSaveMenuItem(editingItem)}
                                className="px-5 py-2.5 text-sm font-bold text-white bg-neutral-900 rounded-lg hover:bg-neutral-800 transition-colors shadow-sm"
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
