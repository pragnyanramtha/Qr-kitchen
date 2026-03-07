"use client";

import { useState, useEffect } from "react";
import { AlertCircle, ListTodo, Package, Users, Power } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import Link from 'next/link';

type ItemCategory = "starter" | "meal" | "drink";

interface MenuItem {
    id: string;
    name: string;
    category: ItemCategory;
    is86d: boolean; // Out of stock flag
}

export default function InventoryDashboard() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isAuthChecking, setIsAuthChecking] = useState(true);
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");

    const [categoryFilter, setCategoryFilter] = useState<ItemCategory | "all">("all");

    const [menu, setMenu] = useState<MenuItem[]>([
        { id: "1", name: "Truffle Fries", category: "starter", is86d: false },
        { id: "2", name: "Garlic Bread", category: "starter", is86d: false },
        { id: "3", name: "Wagyu Sliders", category: "starter", is86d: true },
        { id: "4", name: "Smash Burger Duo", category: "meal", is86d: false },
        { id: "5", name: "Spicy Rigatoni", category: "meal", is86d: false },
        { id: "6", name: "Margherita Pizza", category: "meal", is86d: false },
        { id: "7", name: "Ribeye Steak (12oz)", category: "meal", is86d: false },
        { id: "8", name: "Coke Zero", category: "drink", is86d: false },
        { id: "9", name: "Margarita Mocktail", category: "drink", is86d: false },
        { id: "10", name: "Craft IPA", category: "drink", is86d: true },
    ]);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            if (localStorage.getItem('kds_auth') === 'true') {
                setIsAuthenticated(true);
            }
            setIsAuthChecking(false);
        }
    }, []);

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (password === "kitchen123" || password === "admin") {
            localStorage.setItem('kds_auth', 'true');
            setIsAuthenticated(true);
            setError("");
        } else {
            setError("INCORRECT PIN. ACCESS DENIED.");
            setPassword("");
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('kds_auth');
        setIsAuthenticated(false);
    };

    const toggleItemStatus = (id: string, name: string, currentState: boolean) => {
        setMenu(prev => prev.map(item =>
            item.id === id ? { ...item, is86d: !currentState } : item
        ));

        if (!currentState) {
            toast.error(`${name.toUpperCase()} HAS BEEN 86'd`, {
                style: { borderRadius: '0', background: '#000', color: '#ef4444', border: '1px solid #ef4444' }
            });
        } else {
            toast.success(`${name.toUpperCase()} IS BACK IN STOCK`, {
                style: { borderRadius: '0', background: '#000', color: '#22c55e', border: '1px solid #22c55e' }
            });
        }
    };

    const filteredMenu = menu.filter(item => categoryFilter === "all" || item.category === categoryFilter);

    if (isAuthChecking) {
        return <div className="min-h-screen bg-black flex items-center justify-center"><div className="w-10 h-10 border-4 border-zinc-800 border-t-white rounded-full animate-spin"></div></div>;
    }

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center p-4">
                <form onSubmit={handleLogin} className="w-full max-w-lg border-2 border-zinc-800 p-8 flex flex-col items-start gap-8 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                    <div>
                        <h1 className="text-white text-4xl font-black uppercase tracking-tighter">
                            QR Connect <span className="text-zinc-500">/ 86 MGR</span>
                        </h1>
                        <p className="text-zinc-400 mt-2 font-mono uppercase text-sm border-l-4 border-alert-amber pl-3">
                            Inventory Management Node
                        </p>
                    </div>

                    <div className="w-full relative">
                        <input
                            type="password"
                            placeholder="AUTHORIZATION CODE"
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
                        Access Inventory
                    </button>
                </form>
            </div>
        );
    }

    return (
        <div className="h-dvh flex flex-col bg-(--color-dark-bg) selection:bg-brand-primary selection:text-white overflow-hidden">
            <Toaster position="top-right" toastOptions={{ duration: 3000 }} />

            {/* Header: Exact replica of KDS header layout */}
            <header className="flex-none h-16 md:h-16 border-b border-zinc-800 bg-black flex items-center px-4 sm:px-6 z-10 sticky top-0 w-full">
                {/* LEFT: Branding & Navigation */}
                <div className="flex items-center gap-6 md:w-1/3">
                    <h1 className="text-white font-black text-lg sm:text-2xl uppercase tracking-tighter flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full animate-pulse bg-alert-amber shadow-[0_0_10px_#f59e0b]" />
                        86 MGR
                    </h1>

                    <nav className="hidden lg:flex items-center gap-2 ml-4">
                        <Link href="/kitchen" className="px-3 py-1.5 text-xs font-mono font-bold text-zinc-400 hover:text-white hover:bg-zinc-900 border border-transparent transition-colors flex items-center gap-2">
                            <ListTodo className="w-4 h-4" /> ORDERS
                        </Link>
                        <Link href="/inventory" className="px-3 py-1.5 text-xs font-mono font-bold bg-white text-black flex items-center gap-2">
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
                        onClick={handleLogout}
                        className="hover:text-white transition-colors cursor-pointer border border-zinc-800 px-3 py-1 text-zinc-400 font-mono text-sm uppercase active:scale-95"
                    >
                        LOCK
                    </button>
                </div>
            </header>

            {/* Mobile Navigation */}
            <div className="lg:hidden flex overflow-x-auto bg-zinc-950 p-2 gap-2 no-scrollbar pl-4 justify-center border-b border-zinc-800">
                <Link href="/kitchen" className="px-3 py-2 text-xs font-mono font-bold text-zinc-400 border border-zinc-800 bg-black flex items-center gap-2">
                    <ListTodo className="w-4 h-4" /> ORDERS
                </Link>
                <Link href="/inventory" className="px-3 py-2 text-xs font-mono font-bold bg-white text-black flex items-center gap-2">
                    <Package className="w-4 h-4" /> 86 MENU
                </Link>
                <Link href="/tables" className="px-3 py-2 text-xs font-mono font-bold text-zinc-400 border border-zinc-800 bg-black flex items-center gap-2">
                    <Users className="w-4 h-4" /> TABLES
                </Link>
            </div>

            {/* Mobile Filters */}
            <div className="md:hidden flex overflow-x-auto bg-black border-b border-zinc-800 p-2 gap-2 no-scrollbar pl-4">
                {(["all", "starter", "meal", "drink"] as const).map(f => (
                    <button
                        key={f}
                        onClick={() => setCategoryFilter(f)}
                        className={`px-4 py-2 shrink-0 text-xs font-mono uppercase font-bold transition-all border ${categoryFilter === f ? 'bg-white text-black border-white' : 'text-zinc-400 border-zinc-800 bg-zinc-950'}`}
                    >
                        {f}
                    </button>
                ))}
            </div>

            {/* Main Content List */}
            <main className="flex-1 overflow-y-auto w-full max-w-7xl mx-auto p-4 sm:p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filteredMenu.map(item => (
                        <div
                            key={item.id}
                            className={`flex flex-col border transition-all ${item.is86d ? "border-alert-red bg-alert-red/5" : "border-zinc-800 bg-black hover:border-zinc-600"}`}
                        >
                            <div className="flex items-start justify-between p-6">
                                <div>
                                    <h3 className={`text-2xl font-black uppercase tracking-tight ${item.is86d ? "text-red-500 line-through opacity-70" : "text-white"}`}>
                                        {item.name}
                                    </h3>
                                    <div className="font-mono text-xs mt-2 uppercase text-zinc-500">
                                        Type: {item.category}
                                    </div>
                                </div>

                                {/* 86 / Active Toggle Button */}
                                <button
                                    onClick={() => toggleItemStatus(item.id, item.name, item.is86d)}
                                    className={`w-14 h-14 shrink-0 flex items-center justify-center border-2 transition-all cursor-pointer active:scale-90
                                        ${item.is86d ? "bg-alert-red border-alert-red text-white shadow-[0_0_20px_rgba(239,68,68,0.4)]" : "bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-white hover:text-white"}`}
                                >
                                    <Power className="w-6 h-6" />
                                </button>
                            </div>

                            <div className={`p-4 border-t ${item.is86d ? "border-alert-red/20 bg-alert-red/10" : "border-zinc-800 bg-zinc-950"}`}>
                                {item.is86d ? (
                                    <span className="font-mono text-alert-red uppercase text-sm font-bold flex items-center gap-2"><AlertCircle className="w-4 h-4" /> Status: 86'D / Out of stock</span>
                                ) : (
                                    <span className="font-mono text-alert-green uppercase text-sm flex items-center gap-2">Status: Active & Available</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
}
