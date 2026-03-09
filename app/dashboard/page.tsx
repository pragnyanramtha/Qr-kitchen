"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { 
    Clock, Check, GripVertical, Settings, Bell, 
    UtensilsCrossed, ListTodo, Package, Users, Plus,
    BarChart3, IndianRupee, TrendingUp, Edit3, Trash2, Save, X, Image as ImageIcon, Info, Leaf, Flame, Star,
    Upload, Link as LinkIcon, Archive, Search, Filter, AlertTriangle, ShieldCheck
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import Link from 'next/link';
import { polyfill } from "mobile-drag-drop";
import { scrollBehaviourDragImageTranslateOverride } from "mobile-drag-drop/scroll-behaviour";
import { useRouter } from "next/navigation";
import { collection, onSnapshot, doc, updateDoc, setDoc, deleteDoc, Timestamp, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";

// Types
type OrderStatus = "received" | "cooking" | "ready" | "partially_delivered" | "delivered" | "delayed" | "cancelled";
type ItemCategory = "Starters" | "Mains" | "Drinks" | "Desserts" | "other";

interface OrderItem {
    id: string;
    name: string;
    qty: number;
    price: number;
    notes?: string;
    done?: boolean; 
    status: OrderStatus;
    category: ItemCategory;
}

interface Order {
    id: string;
    table: string;
    items: OrderItem[];
    createdAt: Date;
    status: OrderStatus;
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
    stock?: number;
    lowStockThreshold?: number;
}

const DEFAULT_MENU: MenuItem[] = [
    { id: "burger1", name: "Classic Gourmet Burger", category: "Mains", price: 15.99, available: true, image: "/images/burger.png", description: "Premium beef patty, aged cheddar, fresh lettuce, secret sauce on a brioche bun.", spiceLevel: 0, isVegetarian: false, rating: 4.8, reviews: 128, stock: 50, lowStockThreshold: 10 },
    { id: "pizza1", name: "Margherita Pizza", category: "Mains", price: 18.50, available: true, image: "/images/pizza.png", description: "San Marzano tomato sauce, fresh mozzarella, basil, and extra virgin olive oil.", spiceLevel: 0, isVegetarian: true, rating: 4.9, reviews: 84, stock: 30, lowStockThreshold: 5 },
    { id: "salad1", name: "Caesar Salad", category: "Starters", price: 12.00, available: true, image: "/images/salad.png", description: "Crisp romaine, parmesan cheese, house-made croutons, signature garlic dressing.", spiceLevel: 0, isVegetarian: true, rating: 4.5, reviews: 56, stock: 20, lowStockThreshold: 5 },
    { id: "coffee1", name: "Signature Iced Coffee", category: "Drinks", price: 5.50, available: true, image: "/images/coffee.png", description: "Cold brew coffee, vanilla bean syrup, fresh milk swirl, served over ice.", spiceLevel: 0, isVegetarian: true, rating: 4.7, reviews: 212, stock: 100, lowStockThreshold: 20 },
    { id: "spicy_wings", name: "Inferno Wings (6pcs)", category: "Starters", price: 10.99, available: true, image: "/images/wings.png", description: "Crispy chicken wings tossed in our signature blazing hot pepper sauce.", spiceLevel: 3, isVegetarian: false, rating: 4.6, reviews: 95, stock: 40, lowStockThreshold: 10 },
    { id: "tiramisu", name: "Classic Tiramisu", category: "Desserts", price: 8.50, available: true, image: "/images/tiramisu.png", description: "Espresso-soaked ladyfingers layered with mascarpone cream.", spiceLevel: 0, isVegetarian: true, rating: 4.9, reviews: 156, stock: 15, lowStockThreshold: 5 },
];

export default function OwnerDashboard() {
    const router = useRouter();
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isAuthChecking, setIsAuthChecking] = useState(true);
    
    const [activeTab, setActiveTab] = useState<"orders" | "analytics" | "menu" | "inventory" | "staff" | "settings">("orders");

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
    const [searchQuery, setSearchQuery] = useState("");

    // Firestore real-time listeners
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
        const payload = { ...item, id: docId, rating: item.rating ?? 0, reviews: item.reviews ?? 0, stock: item.stock ?? 0, lowStockThreshold: item.lowStockThreshold ?? 5 };
        await setDoc(doc(db, "inventory", docId), payload);
        setEditingItem(null);
        toast.success("Item saved successfully!");
    };

    const handleDeleteMenuItem = async (id: string) => {
        await deleteDoc(doc(db, "inventory", id));
        toast.success("Item removed from system.");
    };

    const toggleItemAvailability = async (id: string) => {
        const item = menuItems.find(i => i.id === id);
        if (!item) return;
        await updateDoc(doc(db, "inventory", id), { available: !item.available });
    };

    const updateItemStock = async (id: string, newStock: number) => {
        await updateDoc(doc(db, "inventory", id), { stock: newStock });
        toast.success("Stock updated!");
    };

    const seedDefaultMenu = async () => {
        const batch = writeBatch(db);
        DEFAULT_MENU.forEach(item => batch.set(doc(db, "inventory", item.id), item));
        await batch.commit();
        toast.success("Default items seeded!");
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

    if (isAuthChecking) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center"><div className="w-10 h-10 border-4 border-zinc-800 border-t-white rounded-full animate-spin"></div></div>;
    if (!isAuthenticated) return null;

    // Render components
    const renderKanbanColumn = (status: OrderStatus, title: string, badgeColor: string) => {
        const columnOrders = getOrdersForStatus(status);

        return (
            <div className="flex-shrink-0 w-80 lg:w-96 flex flex-col bg-zinc-900/50 rounded-2xl border border-zinc-800/50">
                <div className="p-4 flex items-center justify-between sticky top-0 z-10 rounded-t-2xl">
                    <h3 className="font-semibold text-zinc-100 flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${badgeColor} shadow-[0_0_8px_currentColor]`}></span>
                        {title}
                    </h3>
                    <div className="text-xs font-bold bg-zinc-800 text-zinc-300 px-2.5 py-1 rounded-full border border-zinc-700">{columnOrders.length}</div>
                </div>
                <div className="flex-1 overflow-y-auto p-3 pt-0 flex flex-col gap-3 min-h-0 relative">
                    {columnOrders.map(order => (
                        <div
                            key={order.id}
                            className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 shadow-md hover:border-zinc-700 transition-colors"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <div className="text-lg font-black text-white tracking-tight font-mono">#{order.id.slice(-4)}</div>
                                    <div className="text-sm text-zinc-400 font-medium">Table {order.table}</div>
                                </div>
                                <div className="text-xs text-zinc-300 font-medium flex items-center gap-1.5 bg-zinc-900 px-2 py-1 rounded-md border border-zinc-800">
                                    <Clock className="w-3.5 h-3.5 text-zinc-400" />
                                    {Math.floor((Date.now() - order.createdAt.getTime()) / 60000)}m
                                </div>
                            </div>
                            <div className="space-y-2.5 pt-3 border-t border-zinc-800/50">
                                {order.items.map(item => (
                                    <div key={item.id} className="flex items-start gap-2">
                                        <div className={`mt-0.5 shrink-0 w-5 h-5 rounded flex items-center justify-center border transition-colors ${
                                            item.done ? 'bg-emerald-500 border-emerald-500 text-black' : 'border-zinc-700 bg-zinc-900'
                                        }`}>
                                            {item.done && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
                                        </div>
                                        <div className="flex-1 leading-tight pt-0.5">
                                            <div className={`text-sm ${item.done ? 'line-through text-zinc-500' : 'text-zinc-200'}`}>
                                                <span className="font-bold text-white">{item.qty}x</span> {item.name}
                                            </div>
                                            {item.notes && <div className="text-xs font-medium text-amber-500 mt-1.5 bg-amber-500/10 inline-block px-1.5 py-0.5 rounded border border-amber-500/20">Note: {item.notes}</div>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                    {columnOrders.length === 0 && (
                        <div className="h-24 border-2 border-dashed border-zinc-800 bg-zinc-900/20 rounded-xl flex flex-col items-center justify-center text-zinc-500 text-sm font-medium mt-2">
                            No Orders
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="h-[100dvh] flex bg-black text-zinc-100 overflow-hidden font-sans selection:bg-zinc-800 selection:text-white">
            <Toaster position="top-right" toastOptions={{ style: { background: '#18181b', color: '#fff', border: '1px solid #27272a' } }} />
            
            {/* Sidebar */}
            <aside className="w-64 bg-zinc-950 border-r border-zinc-800 flex flex-col hidden md:flex shrink-0">
                <div className="h-16 flex items-center px-6 border-b border-zinc-800">
                    <div className="w-8 h-8 bg-white text-black flex items-center justify-center font-serif italic text-xl rounded-lg shadow-[0_0_15px_rgba(255,255,255,0.2)]">R</div>
                    <h1 className="text-lg font-black ml-3 tracking-tighter uppercase text-white">
                        Resper <span className="text-zinc-500 font-medium text-xs ml-1">ADMIN</span>
                    </h1>
                </div>

                <div className="p-4 flex-1 flex flex-col gap-1 overflow-y-auto">
                    <div className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 mt-2 px-3">Operations</div>
                    
                    <button 
                        onClick={() => setActiveTab('orders')}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-bold ${activeTab === 'orders' ? 'bg-white text-black shadow-md' : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'}`}
                    >
                        <ListTodo className="w-4 h-4" /> Live Orders
                    </button>
                    
                    <div className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 mt-6 px-3">Management</div>

                    <button 
                        onClick={() => setActiveTab('menu')}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-bold ${activeTab === 'menu' ? 'bg-white text-black shadow-md' : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'}`}
                    >
                        <UtensilsCrossed className="w-4 h-4" /> Menu Content
                    </button>
                    <button 
                        onClick={() => setActiveTab('inventory')}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-bold ${activeTab === 'inventory' ? 'bg-white text-black shadow-md' : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'}`}
                    >
                        <Archive className="w-4 h-4" /> Inventory & Stock
                    </button>
                    
                    <div className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 mt-6 px-3">Business</div>

                    <button 
                        onClick={() => setActiveTab('analytics')}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-bold ${activeTab === 'analytics' ? 'bg-white text-black shadow-md' : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'}`}
                    >
                        <BarChart3 className="w-4 h-4" /> Insights
                    </button>
                    <button 
                        onClick={() => setActiveTab('staff')}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-bold ${activeTab === 'staff' ? 'bg-white text-black shadow-md' : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'}`}
                    >
                        <Users className="w-4 h-4" /> Staff
                    </button>
                    <button 
                        onClick={() => setActiveTab('settings')}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-bold ${activeTab === 'settings' ? 'bg-white text-black shadow-md' : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'}`}
                    >
                        <Settings className="w-4 h-4" /> Settings
                    </button>
                </div>

                <div className="p-4 border-t border-zinc-800">
                    <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-bold text-zinc-400 hover:bg-zinc-900 hover:text-white w-full">
                        <ShieldCheck className="w-4 h-4" /> Sign Out
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative bg-[#0a0a0a]">
                
                {/* Mobile Header */}
                <header className="h-16 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between px-4 md:hidden shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-7 h-7 bg-white text-black flex items-center justify-center font-serif italic text-lg rounded-md">R</div>
                        <h1 className="text-base font-black tracking-tight uppercase">Resper</h1>
                    </div>
                    <select 
                        value={activeTab}
                        onChange={(e) => setActiveTab(e.target.value as any)}
                        className="bg-zinc-900 border border-zinc-800 rounded-md px-3 py-1.5 text-sm font-bold text-white outline-none"
                    >
                        <option value="orders">Orders</option>
                        <option value="menu">Menu</option>
                        <option value="inventory">Inventory</option>
                        <option value="analytics">Analytics</option>
                        <option value="staff">Staff</option>
                        <option value="settings">Settings</option>
                    </select>
                </header>

                {/* 1. ORDERS KANBAN VIEW */}
                {activeTab === 'orders' && (
                    <div className="h-full flex flex-col">
                        <div className="h-16 px-6 flex items-center justify-between border-b border-zinc-800 bg-zinc-950 shrink-0">
                            <h2 className="text-xl font-black tracking-tight text-white uppercase">Live Orders</h2>
                            <div className="flex items-center gap-3 bg-zinc-900 px-3 py-1.5 rounded-full border border-zinc-800">
                                <span className="relative flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </span>
                                <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Sync Active</span>
                            </div>
                        </div>
                        <div className="flex-1 overflow-x-auto no-scrollbar p-6 snap-x flex gap-6 items-start bg-[#0a0a0a]">
                            {renderKanbanColumn("received", "New", "bg-blue-500")}
                            {renderKanbanColumn("cooking", "Preparing", "bg-amber-500")}
                            {renderKanbanColumn("ready", "Ready for Pickup", "bg-emerald-500")}
                            {renderKanbanColumn("partially_delivered", "Partial Delivery", "bg-purple-500")}
                            {renderKanbanColumn("delivered", "Completed", "bg-zinc-500")}
                            {renderKanbanColumn("delayed", "Delayed", "bg-red-500")}
                            {renderKanbanColumn("cancelled", "Cancelled", "bg-zinc-700")}
                        </div>
                    </div>
                )}

                {/* 2. MENU CONTENT MANAGEMENT */}
                {activeTab === 'menu' && (
                    <div className="h-full overflow-y-auto">
                        <div className="bg-zinc-950 border-b border-zinc-800 px-8 py-8 sticky top-0 z-10">
                            <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div>
                                    <h2 className="text-2xl font-black tracking-tight text-white uppercase">Menu Content</h2>
                                    <p className="text-zinc-400 mt-1 text-sm font-medium">Manage item details, photography, and descriptions</p>
                                </div>
                                <button 
                                    onClick={() => setEditingItem({ id: '', name: '', category: 'Mains', price: 0, available: true, image: '', description: '', spiceLevel: 0, isVegetarian: false, stock: 0, lowStockThreshold: 5 })}
                                    className="bg-white text-black px-4 py-2.5 rounded-lg font-bold text-sm flex items-center gap-2 hover:bg-zinc-200 transition-colors shadow-[0_0_15px_rgba(255,255,255,0.1)] w-fit"
                                >
                                    <Plus className="w-4 h-4" /> Add New Item
                                </button>
                            </div>
                        </div>

                        <div className="max-w-6xl mx-auto p-8">
                            {menuItems.length === 0 && (
                                <div className="text-center py-16 border-2 border-dashed border-zinc-800 bg-zinc-900/30 rounded-2xl mb-8">
                                    <p className="text-zinc-500 mb-4 font-bold uppercase tracking-wider">No menu items in system yet.</p>
                                    <button
                                        onClick={seedDefaultMenu}
                                        className="bg-white text-black px-6 py-2.5 rounded-lg font-bold text-sm hover:bg-zinc-200 transition-colors"
                                    >
                                        Seed Default Menu
                                    </button>
                                </div>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                {menuItems.map(item => (
                                    <div key={item.id} className="bg-zinc-950 rounded-2xl border border-zinc-800 shadow-lg overflow-hidden flex flex-col group hover:border-zinc-600 transition-all duration-300">
                                        <div className="h-48 bg-zinc-900 relative overflow-hidden flex items-center justify-center">
                                            {item.image ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90" />
                                            ) : (
                                                <ImageIcon className="w-8 h-8 text-zinc-700" />
                                            )}
                                            
                                            <div className="absolute top-3 right-3 flex gap-2">
                                                {!item.available && (
                                                    <span className="bg-red-500/90 backdrop-blur text-white text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-sm shadow-lg">
                                                        Sold Out
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="p-5 flex-1 flex flex-col">
                                            <div className="flex justify-between items-start mb-2">
                                                <h3 className="text-lg font-black text-white leading-tight uppercase tracking-tight">{item.name}</h3>
                                                <span className="text-lg font-bold text-white bg-zinc-900 px-2 py-1 rounded border border-zinc-800">₹{item.price.toFixed(2)}</span>
                                            </div>
                                            
                                            <p className="text-sm text-zinc-400 line-clamp-2 mb-4 leading-relaxed font-medium">
                                                {item.description || "No description provided."}
                                            </p>

                                            <div className="flex items-center gap-3 mt-auto pt-4 border-t border-zinc-800">
                                                <span className="text-xs font-bold bg-zinc-900 text-zinc-300 px-2.5 py-1 rounded border border-zinc-800 uppercase">
                                                    {item.category}
                                                </span>
                                                {item.isVegetarian && (
                                                    <span className="flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2.5 py-1 rounded uppercase">
                                                        <Leaf className="w-3 h-3" /> Veg
                                                    </span>
                                                )}
                                                <div className="ml-auto flex gap-2">
                                                    <button onClick={() => setEditingItem(item)} className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors border border-transparent hover:border-zinc-700" title="Edit Item">
                                                        <Edit3 className="w-4 h-4" />
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

                {/* 3. INVENTORY & STOCK */}
                {activeTab === 'inventory' && (
                    <div className="h-full overflow-y-auto">
                        <div className="bg-zinc-950 border-b border-zinc-800 px-8 py-8 sticky top-0 z-10">
                            <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div>
                                    <h2 className="text-2xl font-black tracking-tight text-white uppercase">Inventory Management</h2>
                                    <p className="text-zinc-400 mt-1 text-sm font-medium">Track stock levels, set alerts, and manage availability</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="relative">
                                        <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                                        <input 
                                            type="text" 
                                            placeholder="Search items..." 
                                            value={searchQuery}
                                            onChange={e => setSearchQuery(e.target.value)}
                                            className="bg-zinc-900 border border-zinc-800 text-white text-sm rounded-lg pl-9 pr-4 py-2.5 focus:border-zinc-600 outline-none w-64 transition-all"
                                        />
                                    </div>
                                    <button className="bg-zinc-900 border border-zinc-800 text-zinc-300 p-2.5 rounded-lg hover:text-white hover:bg-zinc-800 transition-colors">
                                        <Filter className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="max-w-6xl mx-auto p-8">
                            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl shadow-xl overflow-hidden">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-zinc-900/50 border-b border-zinc-800">
                                            <th className="px-6 py-4 text-xs font-black text-zinc-400 uppercase tracking-widest">Item Name</th>
                                            <th className="px-6 py-4 text-xs font-black text-zinc-400 uppercase tracking-widest">Category</th>
                                            <th className="px-6 py-4 text-xs font-black text-zinc-400 uppercase tracking-widest">Status</th>
                                            <th className="px-6 py-4 text-xs font-black text-zinc-400 uppercase tracking-widest">Stock Level</th>
                                            <th className="px-6 py-4 text-xs font-black text-zinc-400 uppercase tracking-widest text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-800/50">
                                        {menuItems
                                            .filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()))
                                            .map(item => {
                                            const stock = item.stock ?? 0;
                                            const threshold = item.lowStockThreshold ?? 5;
                                            const isLowStock = stock <= threshold && stock > 0;
                                            const isOutOfStock = stock === 0;

                                            return (
                                                <tr key={item.id} className="hover:bg-zinc-900/30 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded bg-zinc-900 border border-zinc-800 overflow-hidden flex-shrink-0">
                                                                {item.image ? (
                                                                    // eslint-disable-next-line @next/next/no-img-element
                                                                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                                                                ) : <ImageIcon className="w-4 h-4 m-auto text-zinc-600" />}
                                                            </div>
                                                            <span className="font-bold text-white">{item.name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="text-xs font-bold text-zinc-400 uppercase bg-zinc-900 px-2 py-1 rounded border border-zinc-800">
                                                            {item.category}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <button 
                                                            onClick={() => toggleItemAvailability(item.id)}
                                                            className={`text-xs font-black uppercase tracking-wider px-3 py-1.5 rounded-full border transition-all ${
                                                                item.available 
                                                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20' 
                                                                    : 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20'
                                                            }`}
                                                        >
                                                            {item.available ? 'Active' : '86\'d'}
                                                        </button>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-4">
                                                            <div className="flex flex-col">
                                                                <span className={`font-mono text-lg font-bold ${
                                                                    isOutOfStock ? 'text-red-500' : isLowStock ? 'text-amber-500' : 'text-white'
                                                                }`}>
                                                                    {stock}
                                                                </span>
                                                                {(isLowStock || isOutOfStock) && (
                                                                    <span className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 mt-0.5" style={{ color: isOutOfStock ? '#ef4444' : '#f59e0b'}}>
                                                                        <AlertTriangle className="w-3 h-3" /> {isOutOfStock ? 'Empty' : 'Low'}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-1 bg-zinc-900 rounded-lg p-1 border border-zinc-800">
                                                                <button onClick={() => updateItemStock(item.id, Math.max(0, stock - 1))} className="w-6 h-6 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 rounded">-</button>
                                                                <button onClick={() => updateItemStock(item.id, stock + 1)} className="w-6 h-6 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 rounded">+</button>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <button onClick={() => setEditingItem(item)} className="text-zinc-500 hover:text-white p-2 transition-colors">
                                                            <Edit3 className="w-4 h-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* 4. ANALYTICS */}
                {activeTab === 'analytics' && (
                    <div className="h-full overflow-y-auto p-8">
                        <div className="max-w-6xl mx-auto">
                            <div className="mb-8">
                                <h2 className="text-2xl font-black tracking-tight text-white uppercase">Performance Insights</h2>
                                <p className="text-zinc-400 mt-1 text-sm font-medium">Real-time metrics for today</p>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                                <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-lg">
                                    <div className="flex items-center gap-3 text-zinc-400 font-bold text-xs uppercase tracking-widest mb-4">
                                        <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded border border-emerald-500/20"><IndianRupee className="w-4 h-4" /></div>
                                        Total Revenue
                                    </div>
                                    <div className="text-4xl font-black tracking-tight text-white">₹{getTotalRevenue().toFixed(2)}</div>
                                </div>
                                <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-lg">
                                    <div className="flex items-center gap-3 text-zinc-400 font-bold text-xs uppercase tracking-widest mb-4">
                                        <div className="p-2 bg-blue-500/10 text-blue-400 rounded border border-blue-500/20"><ListTodo className="w-4 h-4" /></div>
                                        Total Orders
                                    </div>
                                    <div className="text-4xl font-black tracking-tight text-white">{orders.length}</div>
                                </div>
                                <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-lg">
                                    <div className="flex items-center gap-3 text-zinc-400 font-bold text-xs uppercase tracking-widest mb-4">
                                        <div className="p-2 bg-purple-500/10 text-purple-400 rounded border border-purple-500/20"><TrendingUp className="w-4 h-4" /></div>
                                        Avg Ticket Size
                                    </div>
                                    <div className="text-4xl font-black tracking-tight text-white">
                                        ₹{orders.length ? (getTotalRevenue() / orders.length).toFixed(2) : '0.00'}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div className="border border-zinc-800 bg-zinc-950 rounded-2xl p-6 shadow-lg">
                                    <h3 className="font-black text-white uppercase tracking-widest text-sm mb-6 flex items-center gap-2">
                                        <Package className="w-4 h-4 text-zinc-500" /> Popular Items
                                    </h3>
                                    <div className="space-y-4">
                                        {getPopularItems().map((item, idx) => (
                                            <div key={idx} className="flex items-center justify-between pb-4 border-b border-zinc-800/50 last:border-0 last:pb-0">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-8 h-8 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center font-black text-zinc-400 text-sm">{idx + 1}</div>
                                                    <span className="font-bold text-white">{item.name}</span>
                                                </div>
                                                <div className="font-bold text-zinc-300 bg-zinc-900 border border-zinc-800 px-3 py-1 rounded text-sm">{item.qty} sold</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="border border-zinc-800 bg-zinc-950 rounded-2xl p-8 shadow-lg flex flex-col items-center justify-center text-center">
                                    <BarChart3 className="w-12 h-12 text-zinc-700 mb-4" />
                                    <h3 className="text-white font-black uppercase tracking-widest text-sm mb-2">Connect Integrations</h3>
                                    <p className="text-zinc-500 text-sm max-w-sm leading-relaxed font-medium">Connect to Stripe or Square to unlock historical trends, deeper financial insights, and automated tax reporting.</p>
                                    <button className="mt-6 border border-zinc-700 bg-zinc-900 text-white text-sm font-bold uppercase tracking-wider px-6 py-3 rounded hover:bg-white hover:text-black transition-all shadow-lg">
                                        View Connections
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 5. STAFF & SETTINGS PLACEHOLDERS */}
                {(activeTab === 'staff' || activeTab === 'settings') && (
                    <div className="h-full flex items-center justify-center p-8">
                        <div className="text-center max-w-md">
                            {activeTab === 'staff' ? <Users className="w-16 h-16 text-zinc-800 mx-auto mb-6" /> : <Settings className="w-16 h-16 text-zinc-800 mx-auto mb-6" />}
                            <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-2">
                                {activeTab === 'staff' ? 'Staff Management' : 'System Settings'}
                            </h2>
                            <p className="text-zinc-500 font-medium">This module is currently in development. Future updates will include advanced {activeTab === 'staff' ? 'role-based access control, shift scheduling, and performance tracking.' : 'restaurant configuration, tax management, and receipt customization.'}</p>
                        </div>
                    </div>
                )}
            </main>

            {/* Menu Item Edit Modal */}
            {editingItem && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                    <div className="bg-zinc-950 rounded-2xl border border-zinc-800 w-full max-w-2xl shadow-2xl relative animate-in slide-in-from-bottom-4 duration-300 max-h-[90vh] flex flex-col">
                        
                        <div className="flex items-center justify-between p-6 border-b border-zinc-800 shrink-0">
                            <h3 className="text-xl font-black tracking-tight text-white uppercase">{editingItem.id ? 'Edit Configuration' : 'Create New Item'}</h3>
                            <button onClick={() => setEditingItem(null)} className="text-zinc-400 hover:text-white transition-colors bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 p-2 rounded">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                
                                {/* Left Column: Basic Info */}
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-xs font-black text-zinc-500 uppercase tracking-widest mb-2">Item Name</label>
                                        <input 
                                            type="text" 
                                            value={editingItem.name}
                                            onChange={e => setEditingItem({...editingItem, name: e.target.value})}
                                            className="w-full bg-zinc-900 border border-zinc-800 rounded px-4 py-3 text-white font-bold focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 transition-all outline-none"
                                            placeholder="e.g. Classic Gourmet Burger"
                                            autoFocus
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-black text-zinc-500 uppercase tracking-widest mb-2">Price (₹)</label>
                                            <input 
                                                type="number" 
                                                value={editingItem.price}
                                                onChange={e => setEditingItem({...editingItem, price: parseFloat(e.target.value) || 0})}
                                                className="w-full bg-zinc-900 border border-zinc-800 rounded px-4 py-3 text-white font-bold focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 transition-all outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-black text-zinc-500 uppercase tracking-widest mb-2">Category</label>
                                            <select 
                                                value={editingItem.category}
                                                onChange={e => setEditingItem({...editingItem, category: e.target.value as ItemCategory})}
                                                className="w-full bg-zinc-900 border border-zinc-800 rounded px-4 py-3 text-white font-bold focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 transition-all outline-none appearance-none"
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
                                        <label className="block text-xs font-black text-zinc-500 uppercase tracking-widest mb-2">Description</label>
                                        <textarea 
                                            value={editingItem.description}
                                            onChange={e => setEditingItem({...editingItem, description: e.target.value})}
                                            className="w-full bg-zinc-900 border border-zinc-800 rounded px-4 py-3 text-zinc-300 font-medium focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 transition-all outline-none min-h-[100px] resize-none"
                                            placeholder="Write a mouth-watering description..."
                                        />
                                    </div>
                                </div>

                                {/* Right Column: Media & Meta */}
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-xs font-black text-zinc-500 uppercase tracking-widest mb-2">Item Image</label>

                                        {/* Drop / paste zone */}
                                        <div
                                            className="relative h-40 bg-zinc-900 rounded border-2 border-dashed border-zinc-800 overflow-hidden flex items-center justify-center cursor-pointer hover:border-zinc-600 hover:bg-zinc-800/50 transition-all mb-3 group"
                                            onClick={() => fileInputRef.current?.click()}
                                            onPaste={handleImagePaste}
                                            onDragOver={e => e.preventDefault()}
                                            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleImageFile(f); }}
                                            tabIndex={0}
                                        >
                                            {imageUploading ? (
                                                <div className="flex flex-col items-center text-zinc-400">
                                                    <div className="w-6 h-6 border-2 border-zinc-600 border-t-white rounded-full animate-spin mb-2" />
                                                    <span className="text-xs font-bold uppercase tracking-wider">Processing</span>
                                                </div>
                                            ) : editingItem.image ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img src={editingItem.image} alt="Preview" className="h-full w-full object-cover group-hover:opacity-50 transition-opacity" />
                                            ) : (
                                                <div className="flex flex-col items-center text-zinc-600 group-hover:text-zinc-400 transition-colors">
                                                    <Upload className="w-8 h-8 mb-2" />
                                                    <span className="text-xs font-bold uppercase tracking-wider">Upload Image</span>
                                                </div>
                                            )}
                                            {editingItem.image && (
                                                <button
                                                    type="button"
                                                    onClick={e => { e.stopPropagation(); setEditingItem({...editingItem, image: ''}); }}
                                                    className="absolute top-2 right-2 bg-black/80 hover:bg-red-500 text-white rounded p-1.5 transition-colors border border-zinc-800 hover:border-red-500"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>

                                        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleImageFile(f); e.target.value = ''; }} />

                                        {/* URL fallback */}
                                        <div className="flex items-center gap-3">
                                            <LinkIcon className="w-4 h-4 text-zinc-600 shrink-0" />
                                            <input
                                                type="text"
                                                value={editingItem.image.startsWith('data:') ? '' : editingItem.image}
                                                onChange={e => setEditingItem({...editingItem, image: e.target.value})}
                                                className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-300 focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 transition-all outline-none"
                                                placeholder="Or paste an image URL…"
                                            />
                                        </div>
                                    </div>

                                    <div className="bg-zinc-900/50 p-5 rounded border border-zinc-800 space-y-5">
                                        <h4 className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-2">Attributes & Stock</h4>
                                        
                                        <label className="flex items-center justify-between cursor-pointer group">
                                            <div className="flex items-center gap-3">
                                                <div className="p-1.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                                                    <Leaf className="w-4 h-4" />
                                                </div>
                                                <span className="text-sm font-bold text-zinc-300 group-hover:text-white transition-colors">Vegetarian</span>
                                            </div>
                                            <input 
                                                type="checkbox" 
                                                checked={editingItem.isVegetarian}
                                                onChange={e => setEditingItem({...editingItem, isVegetarian: e.target.checked})}
                                                className="w-5 h-5 rounded border-zinc-700 bg-zinc-950 text-white focus:ring-0 focus:ring-offset-0 cursor-pointer"
                                            />
                                        </label>

                                        <div>
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="p-1.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-500">
                                                    <Flame className="w-4 h-4" />
                                                </div>
                                                <span className="text-sm font-bold text-zinc-300">Spice Level <span className="text-zinc-500 ml-1">({editingItem.spiceLevel}/5)</span></span>
                                            </div>
                                            <input 
                                                type="range" 
                                                min="0" max="5" 
                                                value={editingItem.spiceLevel}
                                                onChange={e => setEditingItem({...editingItem, spiceLevel: parseInt(e.target.value)})}
                                                className="w-full accent-white"
                                            />
                                        </div>

                                        <div className="pt-4 border-t border-zinc-800/50">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1.5">Current Stock</label>
                                                    <input 
                                                        type="number" 
                                                        value={editingItem.stock || 0}
                                                        onChange={e => setEditingItem({...editingItem, stock: parseInt(e.target.value) || 0})}
                                                        className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-white font-mono font-bold focus:border-zinc-500 outline-none"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1.5">Low Alert Level</label>
                                                    <input 
                                                        type="number" 
                                                        value={editingItem.lowStockThreshold || 5}
                                                        onChange={e => setEditingItem({...editingItem, lowStockThreshold: parseInt(e.target.value) || 5})}
                                                        className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-white font-mono font-bold focus:border-zinc-500 outline-none"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                </div>

                            </div>
                        </div>

                        <div className="p-6 border-t border-zinc-800 flex justify-end gap-3 shrink-0 bg-zinc-950 rounded-b-2xl">
                            <button 
                                onClick={() => setEditingItem(null)}
                                className="px-6 py-3 text-sm font-bold text-zinc-400 bg-transparent border border-zinc-800 rounded hover:bg-zinc-900 hover:text-white transition-colors uppercase tracking-wider"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={() => handleSaveMenuItem(editingItem)}
                                className="px-6 py-3 text-sm font-black text-black bg-white rounded hover:bg-zinc-200 transition-colors shadow-[0_0_15px_rgba(255,255,255,0.2)] uppercase tracking-wider"
                            >
                                Save Configuration
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}