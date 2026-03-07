"use client";

import { useState, useEffect, useRef } from "react";
import { AlertCircle, Clock, CheckCircle2, ChevronRight, ChevronLeft, Check, Undo2, GripVertical, Settings2, BellRing, UtensilsCrossed, ListTodo, Package, Users, Plus } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import Link from 'next/link';
import { polyfill } from "mobile-drag-drop";
import { scrollBehaviourDragImageTranslateOverride } from "mobile-drag-drop/scroll-behaviour";

// Types
type OrderStatus = "received" | "cooking" | "ready" | "delivered";
type ItemCategory = "starter" | "meal" | "drink" | "other";

interface OrderItem {
    id: string;
    name: string;
    qty: number;
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
}

export default function KitchenDashboard() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isAuthChecking, setIsAuthChecking] = useState(true);
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");

    const [categoryFilter, setCategoryFilter] = useState<ItemCategory | "all">("all");

    useEffect(() => {
        if (typeof window !== 'undefined') {
            if (localStorage.getItem('kds_auth') === 'true') {
                setIsAuthenticated(true);
            }
            setIsAuthChecking(false);
        }
    }, []);

    // Polyfill for drag-and-drop on touch devices
    useEffect(() => {
        // limit polyfill to only run on client
        if (typeof window !== "undefined") {
            polyfill({
                // use this to make sure custom drag images are translated correctly to pointer position
                dragImageTranslateOverride: scrollBehaviourDragImageTranslateOverride
            });
            // required for iOS Safari to allow polyfill 
            window.addEventListener('touchmove', function () { }, { passive: false });
        }
    }, []);

    // State & History
    const [history, setHistory] = useState<Order[][]>([]);
    const [orders, setOrders] = useState<Order[]>([
        {
            id: "1041",
            table: "05",
            createdAt: new Date(Date.now() - 2 * 60000),
            items: [
                { id: "i1", name: "Truffle Fries", qty: 1, status: "received", category: "starter" },
                { id: "i2", name: "Smash Burger Duo", qty: 2, notes: "No pickles", status: "received", category: "meal" },
                { id: "i3", name: "Coke Zero", qty: 2, status: "received", category: "drink" }
            ]
        },
        {
            id: "1042",
            table: "12",
            createdAt: new Date(Date.now() - 15 * 60000),
            items: [
                { id: "i4", name: "Garlic Bread", qty: 2, done: false, status: "cooking", category: "starter" },
                { id: "i5", name: "Spicy Rigatoni", qty: 1, done: true, status: "cooking", category: "meal" }
            ]
        },
        {
            id: "1043",
            table: "02",
            createdAt: new Date(Date.now() - 22 * 60000),
            items: [
                { id: "i6", name: "Margherita Pizza", qty: 1, done: true, status: "ready", category: "meal" },
                { id: "i7", name: "Margarita Mocktail", qty: 2, done: true, status: "ready", category: "drink" }
            ]
        }
    ]);

    const [dragHover, setDragHover] = useState<OrderStatus | null>(null);

    // Custom 2-finger scroll handler for touch devices
    const scrollRefs = {
        received: useRef<HTMLDivElement>(null),
        cooking: useRef<HTMLDivElement>(null),
        ready: useRef<HTMLDivElement>(null)
    };

    useEffect(() => {
        const handleTouchMove = (e: TouchEvent) => {
            if (e.touches.length === 2) {
                // Potential logic to handle 2-finger scroll if touch-action: none is blocking it
                // However, standard browser behavior for 2-finger is often ignored if 1-finger is blocked
                // We will rely on touch-action optimization first
            }
        };
        window.addEventListener('touchmove', handleTouchMove, { passive: false });
        return () => window.removeEventListener('touchmove', handleTouchMove);
    }, []);

    // Initial Audio Setup
    const saveHistory = (currentOrders: Order[]) => {
        setHistory(prev => [...prev.slice(-19), currentOrders]);
    };

    const handleUndo = () => {
        if (history.length === 0) return;
        const previous = history[history.length - 1];
        setOrders(previous);
        setHistory(prev => prev.slice(0, -1));
        toast.error("ACTION UNDONE", {
            style: { borderRadius: '0', background: '#333', color: '#fff', fontWeight: 'bold' },
            icon: '🔙'
        });
    };

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (password === "kitchen123" || password === "admin") {
            localStorage.setItem('kds_auth', 'true');
            setIsAuthenticated(true);
            setError("");
        } else {
            setError("INCORRECT KITCHEN CODE. ACCESS DENIED.");
            setPassword("");
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('kds_auth');
        setIsAuthenticated(false);
    };

    const toggleItemDone = (orderId: string, itemId: string) => {
        saveHistory(orders);
        setOrders(prev => prev.map(order => {
            if (order.id !== orderId) return order;
            return {
                ...order,
                items: order.items.map(item =>
                    item.id === itemId ? { ...item, done: !item.done } : item
                )
            };
        }));
    };

    const advanceItemsStatus = (orderId: string, sourceStatus: OrderStatus, targetStatus?: OrderStatus) => {
        saveHistory(orders);
        setOrders(prev => prev.map(order => {
            if (order.id !== orderId) return order;
            return {
                ...order,
                items: order.items.map(item => {
                    if (item.status !== sourceStatus) return item;

                    let newStatus: OrderStatus = item.status;
                    if (targetStatus) {
                        newStatus = targetStatus;
                    } else if (item.status === "received") newStatus = "cooking";
                    else if (item.status === "cooking") newStatus = "ready";
                    else if (item.status === "ready") newStatus = "delivered";

                    return { ...item, status: newStatus };
                })
            };
        }));
    };

    const moveSingleItem = (orderId: string, itemId: string, targetStatus: OrderStatus) => {
        saveHistory(orders);
        setOrders(prev => prev.map(order => {
            if (order.id !== orderId) return order;
            return {
                ...order,
                items: order.items.map(item =>
                    item.id === itemId ? { ...item, status: targetStatus } : item
                )
            };
        }));
    };

    // HTML5 Drag Handlers (Enhanced by mobile-drag-drop)
    const handleDragStartOrder = (e: React.DragEvent | React.TouchEvent, orderId: string, sourceStatus: OrderStatus) => {
        if ('dataTransfer' in e) {
            e.dataTransfer.setData('application/json', JSON.stringify({ type: 'order', orderId, sourceStatus }));
            e.dataTransfer.effectAllowed = 'move';
        }
    };

    const handleDragStartItem = (e: React.DragEvent | React.TouchEvent, orderId: string, itemId: string) => {
        e.stopPropagation();
        if ('dataTransfer' in e) {
            e.dataTransfer.setData('application/json', JSON.stringify({ type: 'item', orderId, itemId }));
            e.dataTransfer.effectAllowed = 'move';
        }
    };

    const handleDrop = (e: React.DragEvent, targetStatus: OrderStatus) => {
        e.preventDefault();
        setDragHover(null);
        try {
            const data = JSON.parse(e.dataTransfer.getData('application/json'));
            if (data.type === 'item') {
                moveSingleItem(data.orderId, data.itemId, targetStatus);
            } else if (data.type === 'order') {
                advanceItemsStatus(data.orderId, data.sourceStatus, targetStatus);
            }
        } catch (err) {
            console.error("Drop Parse Error", err);
        }
    };

    const getOrdersForStatus = (status: OrderStatus) => {
        return orders.filter(o => o.items.some(i => i.status === status && (categoryFilter === "all" || i.category === categoryFilter)))
            .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    };

    const getWaitTimeMap = (createdAt: Date) => {
        return Math.floor((Date.now() - createdAt.getTime()) / 60000);
    };

    const [, setTick] = useState(0);
    useEffect(() => {
        if (!isAuthenticated) return;
        const interval = setInterval(() => setTick(t => t + 1), 60000);
        return () => clearInterval(interval);
    }, [isAuthenticated]);

    if (isAuthChecking) {
        return <div className="min-h-screen bg-black flex items-center justify-center"><div className="w-10 h-10 border-4 border-zinc-800 border-t-white rounded-full animate-spin"></div></div>;
    }

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center p-4">
                <form onSubmit={handleLogin} className="w-full max-w-lg border-2 border-zinc-800 p-8 flex flex-col items-start gap-8 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                    <div>
                        <h1 className="text-white text-4xl font-black uppercase tracking-tighter">
                            QR Connect <span className="text-zinc-500">/ Kitchen</span>
                        </h1>
                        <p className="text-zinc-400 mt-2 font-mono uppercase text-sm border-l-4 border-alert-amber pl-3">
                            KDS Terminal Authorization Required
                        </p>
                    </div>

                    <div className="w-full relative">
                        <input
                            type="password"
                            placeholder="ENTER PASSCODE"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-zinc-950 border-2 border-zinc-700 text-white p-4 font-mono uppercase text-2xl tracking-widest focus:outline-none focus:border-white focus:ring-0 transition-colors"
                            autoFocus
                        />
                        {error && (
                            <p className="text-alert-red font-mono uppercase text-xs mt-3 flex items-center gap-2">
                                <AlertCircle className="w-4 h-4" /> {error}
                            </p>
                        )}
                    </div>

                    <button
                        type="submit"
                        className="w-full bg-white text-black font-black uppercase tracking-widest text-xl py-5 hover:bg-zinc-200 transition-colors active:scale-[0.99] cursor-pointer"
                    >
                        Authenticate
                    </button>
                </form>
            </div>
        );
    }

    // Helper Column Renderer
    const renderColumn = (status: OrderStatus, title: string, colorTheme: "alert-red" | "alert-amber" | "alert-green") => {
        const columnOrders = getOrdersForStatus(status);
        const isHovered = dragHover === status;

        return (
            <section
                ref={scrollRefs[status as keyof typeof scrollRefs]}
                onDragOver={(e) => { e.preventDefault(); setDragHover(status); }}
                onDragEnter={(e) => { e.preventDefault(); setDragHover(status); }}
                onDragLeave={() => setDragHover(null)}
                onDrop={(e) => handleDrop(e, status)}
                className={`flex flex-col bg-black/40 border-r border-zinc-800 last:border-r-0 transition-all duration-300 touch-action-pan-y select-none
                    ${isHovered ? 'bg-zinc-900 shadow-[inset_0_0_100px_rgba(255,255,255,0.08)]' : ''}`}
            >
                <div className={`py-4 px-5 border-b border-zinc-800 bg-black sticky top-0 z-10 flex items-center justify-between transition-colors ${isHovered ? 'bg-zinc-900 border-zinc-700' : ''}`}>
                    <h2 className={`font-black uppercase text-xl transition-all ${isHovered ? 'scale-105' : ''} text-${colorTheme === 'alert-red' ? 'white' : colorTheme}`}>{title}</h2>
                    <div className={`flex items-center justify-center font-mono text-sm h-7 w-7 rounded transition-colors ${isHovered ? 'bg-white text-black' : 'bg-zinc-800 text-white'}`}>
                        {columnOrders.length}
                    </div>
                </div>

                <div 
                    onDragOver={(e) => { e.preventDefault(); setDragHover(status); }}
                    onDrop={(e) => handleDrop(e, status)}
                    className="flex-1 overflow-y-auto p-4 flex flex-col gap-5 min-h-0 relative items-stretch"
                >
                    {columnOrders.map(order => (
                        <OrderCard
                            key={`${order.id}-${status}`}
                            order={order}
                            columnStatus={status}
                            colorTheme={colorTheme}
                        />
                    ))}

                    {/* Greedy Drop Indicator - huge target at bottom */}
                    <div 
                        className={`flex-1 flex flex-col items-center justify-center transition-all duration-300 min-h-[150px]
                            ${columnOrders.length === 0 ? 'h-full' : 'mt-2'}
                            ${isHovered 
                                ? 'border-2 border-dashed border-white/40 bg-white/5 opacity-100 rounded-xl' 
                                : columnOrders.length === 0 
                                    ? 'border-2 border-dashed border-zinc-800/50 bg-black/10 rounded-xl'
                                    : 'border-0 opacity-0 h-0 min-h-0 overflow-hidden'}`}
                    >
                         <div className={`font-black uppercase tracking-widest text-center transition-all ${isHovered ? 'scale-110 text-white' : 'text-zinc-600'}`}>
                             {isHovered ? (
                                 <div className="flex flex-col items-center gap-3">
                                     <div className="p-4 rounded-full bg-white/10 ring-4 ring-white/5 animate-pulse">
                                         <Plus className="w-8 h-8 text-white" />
                                     </div>
                                     <span className="text-sm">Release to Move</span>
                                 </div>
                             ) : columnOrders.length === 0 ? (
                                 <div className="flex flex-col items-center gap-2">
                                     <span className="text-lg opacity-40">Column Empty</span>
                                     <span className="text-[10px] opacity-20 font-mono">Drop orders here to process</span>
                                 </div>
                             ) : null}
                         </div>
                    </div>
                </div>
            </section>
        );
    };

    // Card Renderer (only shows items for this specific status column)
    function OrderCard({
        order,
        columnStatus,
        colorTheme
    }: {
        order: Order;
        columnStatus: OrderStatus;
        colorTheme: "alert-red" | "alert-amber" | "alert-green";
    }) {
        const mins = getWaitTimeMap(order.createdAt);
        const isLate = mins > 15 && columnStatus !== "ready";

        // Filter items based on both the column's status AND the global category filter
        const columnItems = order.items.filter(i =>
            i.status === columnStatus &&
            (categoryFilter === "all" || i.category === categoryFilter)
        );

        if (columnItems.length === 0) return null; // Hide card if filter empties it out

        const bgHeaderClass =
            colorTheme === "alert-red" ? "bg-red-500/10 text-red-500" :
                colorTheme === "alert-amber" ? "bg-amber-500/10 text-amber-500" :
                    "bg-green-500/10 text-green-500";
        const barClass =
            colorTheme === "alert-red" ? "bg-red-500" :
                colorTheme === "alert-amber" ? "bg-amber-500" :
                    "bg-green-500";

        const isAllDone = columnItems.every(item => item.done);

        const categories: ItemCategory[] = ["starter", "meal", "drink", "other"];
        const groupedItems = categories.map(cat => ({
            category: cat,
            items: columnItems.filter(i => i.category === cat)
        })).filter(g => g.items.length > 0);

        return (
            <div
                draggable
                onDragStart={(e) => handleDragStartOrder(e, order.id, columnStatus)}
                onTouchStart={(e) => handleDragStartOrder(e, order.id, columnStatus)}
                className={`flex flex-col border bg-(--color-dark-surface) shadow-lg transition-colors animate-in slide-in-from-bottom-2 duration-300 relative group cursor-grab active:cursor-grabbing border-zinc-800 hover:border-zinc-500`}
            >
                <div className={`h-1 w-full ${barClass}`} />

                <div className={`flex items-start justify-between p-4 ${bgHeaderClass} border-b border-zinc-800/50`}>
                    <div className="flex items-center gap-3">
                        <div className="p-2 -ml-2 hover:bg-white/10 rounded hidden sm:block">
                            <GripVertical className="w-6 h-6 opacity-40 hover:opacity-100" />
                        </div>
                        <div>
                            <div className="text-2xl font-black uppercase leading-none text-white flex items-center gap-2">
                                <span className="opacity-50 font-mono text-base">#</span>{order.id}
                            </div>
                            <div className="font-mono text-sm mt-1 opacity-80 uppercase font-semibold">
                                Table {order.table}
                            </div>
                        </div>
                    </div>
                    <div className={`flex items-center gap-2 font-mono text-lg font-black ${isLate ? "animate-pulse text-alert-red" : "opacity-90"}`}>
                        <Clock className="w-4 h-4" /> {mins}m
                    </div>
                </div>

                <div className="flex-1 p-0 pb-2">
                    {groupedItems.map(group => (
                        <div key={group.category} className="mt-2 text-zinc-300">
                            <div className="text-zinc-500 font-mono text-[10px] uppercase tracking-widest px-4 py-1.5 bg-zinc-900/50">
                                — {group.category}
                            </div>
                            <ul className="divide-y divide-zinc-800/50">
                                {group.items.map(item => (
                                    <li
                                        key={item.id}
                                        draggable
                                        onDragStart={(e) => handleDragStartItem(e, order.id, item.id)}
                                        onTouchStart={(e) => handleDragStartItem(e, order.id, item.id)}
                                        className={`flex items-start gap-4 p-4 lg:p-5 hover:bg-white/5 transition-colors group/item 
                                            ${item.done ? "opacity-30 bg-black/20" : ""} 
                                            cursor-grab active:cursor-grabbing`}
                                    >
                                        <div className="p-1 -ml-1 -mt-1 hover:bg-white/10 rounded md:hidden touch-action-none flex items-center justify-center">
                                            <GripVertical className="w-7 h-7 opacity-70 shrink-0 text-white" />
                                        </div>
                                        <GripVertical className="hidden md:block w-4 h-4 opacity-0 group-hover/item:opacity-40 shrink-0 mt-1" />

                                        <div
                                            className={`w-7 h-7 sm:w-6 sm:h-6 shrink-0 mt-0 sm:mt-0.5 border-2 flex items-center justify-center transition-colors cursor-pointer ${item.done ? "border-alert-green bg-alert-green" : "border-zinc-600"}`}
                                            onClick={(e) => { e.stopPropagation(); toggleItemDone(order.id, item.id); }}
                                        >
                                            {item.done && <Check className="w-4 h-4 text-black" strokeWidth={4} />}
                                        </div>

                                        <div className="min-w-0 flex-1 flex flex-col">
                                            <div className="min-w-0">
                                                <span className={`text-lg sm:text-xl font-bold leading-none wrap-break-word ${item.done ? "line-through text-zinc-500" : "text-zinc-100"}`}>
                                                    {item.qty}x {item.name}
                                                </span>
                                            </div>
                                            {item.notes && (
                                                <div className="mt-2 p-2 bg-red-500/10 border-l-2 border-red-500 text-red-400 font-mono uppercase text-sm leading-tight">
                                                    <span className="font-bold mr-2 text-red-500">NOTE:</span>
                                                    {item.notes}
                                                </div>
                                            )}
                                        </div>

                                        {/* Individual Item Movement Buttons */}
                                        <div className="flex flex-col items-center gap-1 sm:gap-1.5 ml-4 shrink-0 self-center">
                                            {columnStatus !== "received" && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); moveSingleItem(order.id, item.id, columnStatus === "ready" ? "cooking" : "received"); }}
                                                    className="w-12 h-12 bg-zinc-800 hover:bg-white hover:text-black border border-zinc-700 text-white transition-all active:scale-95 shadow-md flex items-center justify-center cursor-pointer"
                                                >
                                                    <ChevronLeft className="w-6 h-6" />
                                                </button>
                                            )}
                                            {columnStatus !== "ready" && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); moveSingleItem(order.id, item.id, columnStatus === "received" ? "cooking" : "ready"); }}
                                                    className="w-12 h-12 bg-white text-black hover:bg-zinc-200 transition-all active:scale-95 shadow-md flex items-center justify-center cursor-pointer"
                                                >
                                                    <ChevronRight className="w-6 h-6" />
                                                </button>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                <div className="p-3 border-t border-zinc-800 bg-black/20 shrink-0">
                    {/* Mobile targeted status advance buttons (since Drag/Drop on pure HTML5 is hard on touch) */}
                    <div className="flex gap-2">
                        {columnStatus === "cooking" && (
                            <button
                                onClick={(e) => { e.stopPropagation(); advanceItemsStatus(order.id, columnStatus, "received"); }}
                                className="flex-none p-4 px-5 border-2 border-zinc-800 bg-black text-white active:scale-95 focus:outline-none focus:ring-2 focus:ring-white"
                                aria-label="Move back to received"
                            >
                                <Undo2 className="w-5 h-5" />
                            </button>
                        )}
                        {columnStatus === "ready" && (
                            <button
                                onClick={(e) => { e.stopPropagation(); advanceItemsStatus(order.id, columnStatus, "cooking"); }}
                                className="flex-none p-4 px-5 border-2 border-zinc-800 bg-black text-white active:scale-95"
                                aria-label="Move back to cooking"
                            >
                                <Undo2 className="w-5 h-5" />
                            </button>
                        )}

                        <button
                            onClick={(e) => { e.stopPropagation(); advanceItemsStatus(order.id, columnStatus); }}
                            className={`flex-1 py-4 px-2 flex items-center justify-center gap-2 uppercase font-black tracking-wider text-sm sm:text-base border-2 transition-all cursor-pointer active:scale-95 select-none touch-manipulation
                                ${isAllDone && columnStatus !== 'ready'
                                    ? 'bg-white text-black border-white hover:bg-zinc-200 shadow-[0_0_15px_rgba(255,255,255,0.3)]'
                                    : columnStatus === 'ready'
                                        ? 'bg-alert-green text-black border-alert-green hover:bg-green-400 font-medium'
                                        : 'bg-transparent text-white border-zinc-700 hover:border-zinc-400 hover:bg-zinc-800'}
                            `}
                        >
                            {columnStatus === "received" ? (
                                <>Start Cooking <ChevronRight className="w-5 h-5 shrink-0" /></>
                            ) : columnStatus === "cooking" ? (
                                <>Mark Ready <ChevronRight className="w-5 h-5 shrink-0" /></>
                            ) : (
                                <>Mark Delivered <CheckCircle2 className="w-5 h-5 shrink-0" /></>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-[100dvh] flex flex-col bg-(--color-dark-bg) selection:bg-brand-primary selection:text-white overflow-hidden">
            <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
            <header className="flex-none h-16 md:h-16 border-b border-zinc-800 bg-black flex items-center px-4 sm:px-6 z-10 sticky top-0 w-full">

                {/* LEFT: Branding & Navigation */}
                <div className="flex items-center gap-6 md:w-1/3">
                    <h1 className="text-white font-black text-lg sm:text-2xl uppercase tracking-tighter flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full animate-pulse bg-alert-green shadow-[0_0_10px_#22c55e]" />
                        KDS
                    </h1>

                    <nav className="hidden lg:flex items-center gap-2 ml-4">
                        <Link href="/kitchen" className="px-3 py-1.5 text-xs font-mono font-bold bg-white text-black flex items-center gap-2">
                            <ListTodo className="w-4 h-4" /> ORDERS
                        </Link>
                        <Link href="/inventory" className="px-3 py-1.5 text-xs font-mono font-bold text-zinc-400 hover:text-white hover:bg-zinc-900 border border-transparent transition-colors flex items-center gap-2">
                            <Package className="w-4 h-4" /> INVENTORY
                        </Link>
                        <Link href="/tables" className="px-3 py-1.5 text-xs font-mono font-bold text-zinc-400 hover:text-white hover:bg-zinc-900 border border-transparent transition-colors flex items-center gap-2">
                            <Users className="w-4 h-4" /> TABLES
                        </Link>
                    </nav>
                </div>

                {/* MIDDLE: Filters */}
                <div className="flex-1 flex justify-center">
                    <div className="hidden md:flex items-center gap-1 bg-zinc-900 p-1 border border-zinc-800 rounded">
                        {(["all", "starter", "meal", "drink"] as const).map(f => (
                            <button
                                key={f}
                                onClick={() => setCategoryFilter(f)}
                                className={`px-4 py-1.5 text-xs font-mono uppercase font-bold transition-all ${categoryFilter === f ? 'bg-white text-black shadow-sm' : 'text-zinc-500 hover:text-white hover:bg-zinc-800'}`}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                </div>

                {/* RIGHT: Actions */}
                <div className="flex flex-1 justify-end items-center gap-3 sm:gap-4 shrink-0">
                    <button
                        onClick={handleUndo}
                        disabled={history.length === 0}
                        className={`flex items-center gap-2 border px-4 py-1.5 font-mono text-sm uppercase transition-colors ${history.length > 0 ? "border-zinc-500 text-white hover:bg-zinc-800 hover:border-white shadow-[0_0_10px_rgba(255,255,255,0.1)] active:scale-95" : "border-zinc-800 text-zinc-600 cursor-not-allowed opacity-50"
                            }`}
                        title="Undo Last Action"
                    >
                        <Undo2 className="w-4 h-4" /> <span className="hidden sm:inline">Undo</span>
                    </button>

                    <button
                        onClick={handleLogout}
                        className="hidden sm:block hover:text-white transition-colors cursor-pointer border border-zinc-800 px-3 py-1 text-zinc-400 font-mono text-sm uppercase active:scale-95"
                    >
                        LOCK
                    </button>
                </div>
            </header>

            {/* Mobile Filters Header */}
            <div className="md:hidden flex overflow-x-auto bg-black border-b border-zinc-800 p-2 gap-2 no-scrollbar pl-4">
                {(["all", "starter", "meal", "drink"] as const).map(f => (
                    <button
                        key={f}
                        onClick={() => setCategoryFilter(f)}
                        className={`px-4 py-2 flex-shrink-0 text-xs font-mono uppercase font-bold transition-all border ${categoryFilter === f ? 'bg-white text-black border-white' : 'text-zinc-400 border-zinc-800 bg-zinc-950'}`}
                    >
                        {f}
                    </button>
                ))}
            </div>

            <div className="lg:hidden flex overflow-x-auto bg-zinc-950 p-2 gap-2 no-scrollbar pl-4 justify-center">
                <Link href="/kitchen" className="px-3 py-2 text-xs font-mono font-bold bg-white text-black flex items-center gap-2">
                    <ListTodo className="w-4 h-4" /> ORDERS
                </Link>
                <Link href="/inventory" className="px-3 py-2 text-xs font-mono font-bold text-zinc-400 border border-zinc-800 bg-black flex items-center gap-2">
                    <Package className="w-4 h-4" /> 86 MENU
                </Link>
                <Link href="/tables" className="px-3 py-2 text-xs font-mono font-bold text-zinc-400 border border-zinc-800 bg-black flex items-center gap-2">
                    <Users className="w-4 h-4" /> TABLES
                </Link>
            </div>

            {/* Main Content Grid */}
            <main className="flex-1 overflow-x-auto min-w-0 md:w-full flex md:grid md:grid-cols-3 min-h-0 bg-(--color-dark-bg) snap-x snap-mandatory">

                {/* Render cols wrapping in snap containers for mobile swipe */}
                <div className="min-w-[90vw] sm:min-w-[400px] md:min-w-0 h-full flex-shrink-0 snap-center md:snap-align-none border-r border-zinc-800">
                    {renderColumn("received", "1. Received", "alert-red")}
                </div>
                <div className="min-w-[90vw] sm:min-w-[400px] md:min-w-0 h-full flex-shrink-0 snap-center md:snap-align-none border-r border-zinc-800">
                    {renderColumn("cooking", "2. Cooking", "alert-amber")}
                </div>
                <div className="min-w-[90vw] sm:min-w-[400px] md:min-w-0 h-full flex-shrink-0 snap-center md:snap-align-none">
                    {renderColumn("ready", "3. Ready", "alert-green")}
                </div>

            </main>
        </div>
    );
}
