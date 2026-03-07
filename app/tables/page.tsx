"use client";

import { useState, useEffect } from "react";
import { AlertCircle, Clock, ListTodo, Package, Users, ChefHat, CheckCircle2 } from "lucide-react";
import Link from 'next/link';

type OrderStatus = "received" | "cooking" | "ready" | "delivered";
type ItemCategory = "starter" | "meal" | "drink" | "other";

interface OrderItem {
    id: string;
    name: string;
    qty: number;
    status: OrderStatus;
    category: ItemCategory;
}

interface TableSession {
    tableNumber: string;
    partyName: string;
    guests: number;
    seatedAt: Date;
    orders: {
        id: string;
        items: OrderItem[];
    }[];
}

export default function TablesDashboard() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isAuthChecking, setIsAuthChecking] = useState(true);
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");

    const [tables] = useState<TableSession[]>([
        {
            tableNumber: "05",
            partyName: "Guest_294X",
            guests: 3,
            seatedAt: new Date(Date.now() - 45 * 60000), // 45 mins ago
            orders: [
                {
                    id: "1041",
                    items: [
                        { id: "i1", name: "Truffle Fries", qty: 1, status: "received", category: "starter" },
                        { id: "i2", name: "Smash Burger Duo", qty: 2, status: "received", category: "meal" },
                        { id: "i3", name: "Coke Zero", qty: 2, status: "received", category: "drink" }
                    ]
                }
            ]
        },
        {
            tableNumber: "12",
            partyName: "Guest_112A",
            guests: 2,
            seatedAt: new Date(Date.now() - 25 * 60000),
            orders: [
                {
                    id: "1042",
                    items: [
                        { id: "i4", name: "Garlic Bread", qty: 2, status: "cooking", category: "starter" },
                        { id: "i5", name: "Spicy Rigatoni", qty: 1, status: "cooking", category: "meal" }
                    ]
                }
            ]
        },
        {
            tableNumber: "02",
            partyName: "VIP_Smith",
            guests: 4,
            seatedAt: new Date(Date.now() - 90 * 60000),
            orders: [
                {
                    id: "1043",
                    items: [
                        { id: "i6", name: "Margherita Pizza", qty: 1, status: "ready", category: "meal" },
                        { id: "i7", name: "Margarita Mocktail", qty: 2, status: "ready", category: "drink" }
                    ]
                }
            ]
        }
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

    const getWaitTimeMap = (createdAt: Date) => {
        return Math.floor((Date.now() - createdAt.getTime()) / 60000);
    };

    if (isAuthChecking) {
        return <div className="min-h-screen bg-black flex items-center justify-center"><div className="w-10 h-10 border-4 border-zinc-800 border-t-white rounded-full animate-spin"></div></div>;
    }

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center p-4">
                <form onSubmit={handleLogin} className="w-full max-w-lg border-2 border-zinc-800 p-8 flex flex-col items-start gap-8 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                    <div>
                        <h1 className="text-white text-4xl font-black uppercase tracking-tighter">
                            QR Connect <span className="text-zinc-500">/ TABLES</span>
                        </h1>
                        <p className="text-zinc-400 mt-2 font-mono uppercase text-sm border-l-4 border-alert-amber pl-3">
                            Front-of-House Overview
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
                        Access Floor Plan
                    </button>
                </form>
            </div>
        );
    }

    return (
        <div className="h-dvh flex flex-col bg-(--color-dark-bg) selection:bg-brand-primary selection:text-white overflow-hidden">

            {/* Header: Exact replica of KDS header layout */}
            <header className="flex-none h-16 md:h-16 border-b border-zinc-800 bg-black flex items-center px-4 sm:px-6 z-10 sticky top-0 w-full">
                {/* LEFT: Branding & Navigation */}
                <div className="flex items-center gap-6 md:w-1/3">
                    <h1 className="text-white font-black text-lg sm:text-2xl uppercase tracking-tighter flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full animate-pulse bg-white shadow-[0_0_10px_#ffffff]" />
                        TABLES
                    </h1>

                    <nav className="hidden lg:flex items-center gap-2 ml-4">
                        <Link href="/kitchen" className="px-3 py-1.5 text-xs font-mono font-bold text-zinc-400 hover:text-white hover:bg-zinc-900 border border-transparent transition-colors flex items-center gap-2">
                            <ListTodo className="w-4 h-4" /> ORDERS
                        </Link>
                        <Link href="/inventory" className="px-3 py-1.5 text-xs font-mono font-bold text-zinc-400 hover:text-white hover:bg-zinc-900 border border-transparent transition-colors flex items-center gap-2">
                            <Package className="w-4 h-4" /> INVENTORY
                        </Link>
                        <Link href="/tables" className="px-3 py-1.5 text-xs font-mono font-bold bg-white text-black border border-transparent transition-colors flex items-center gap-2">
                            <Users className="w-4 h-4" /> TABLES
                        </Link>
                    </nav>
                </div>

                {/* MIDDLE & RIGHT (Empty for Tables MVP) */}
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
                <Link href="/inventory" className="px-3 py-2 text-xs font-mono font-bold text-zinc-400 border border-zinc-800 bg-black flex items-center gap-2">
                    <Package className="w-4 h-4" /> 86 MENU
                </Link>
                <Link href="/tables" className="px-3 py-2 text-xs font-mono font-bold bg-white text-black flex items-center gap-2">
                    <Users className="w-4 h-4" /> TABLES
                </Link>
            </div>

            {/* Main Content Grid */}
            <main className="flex-1 overflow-y-auto w-full p-6 sm:p-10">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 max-w-7xl mx-auto">
                    {tables.map(session => {
                        const minsSeated = getWaitTimeMap(session.seatedAt);

                        return (
                            <div key={session.tableNumber} className="flex flex-col border border-zinc-700 bg-(--color-dark-surface) shadow-[0_0_20px_rgba(0,0,0,0.5)]">
                                {/* Table Header */}
                                <div className="p-6 border-b border-zinc-800 bg-zinc-900/50 flex items-start justify-between">
                                    <div>
                                        <div className="text-4xl font-black uppercase tracking-tighter text-white flex items-center gap-2">
                                            <span className="opacity-40 font-mono text-xl">TB</span>{session.tableNumber}
                                        </div>
                                        <div className="font-mono text-sm mt-2 text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                                            <Users className="w-4 h-4" /> {session.guests} PAX • {session.partyName}
                                        </div>
                                    </div>

                                    <div className="text-right">
                                        <div className="font-mono text-2xl font-bold flex items-center gap-2 text-zinc-300">
                                            <Clock className="w-5 h-5" /> {minsSeated}m
                                        </div>
                                        <div className="text-[10px] font-mono uppercase text-zinc-500 mt-1">Seated</div>
                                    </div>
                                </div>

                                {/* Active Orders List inside Table */}
                                <div className="flex-1 p-6 space-y-6">
                                    {session.orders.map(order => (
                                        <div key={order.id} className="space-y-3">
                                            <div className="flex items-center gap-3">
                                                <div className="h-px flex-1 bg-zinc-800"></div>
                                                <span className="text-xs uppercase font-mono text-zinc-500 font-bold tracking-widest">Order #{order.id}</span>
                                                <div className="h-px flex-1 bg-zinc-800"></div>
                                            </div>

                                            <ul className="space-y-3">
                                                {order.items.map(item => {
                                                    let statusColorClass = "text-zinc-500 bg-zinc-500/10 border-zinc-500";
                                                    let icon = <ListTodo className="w-4 h-4" />;

                                                    if (item.status === 'received') {
                                                        statusColorClass = "text-alert-red bg-alert-red/10 border-alert-red";
                                                        icon = <AlertCircle className="w-4 h-4" />;
                                                    } else if (item.status === 'cooking') {
                                                        statusColorClass = "text-alert-amber bg-alert-amber/10 border-alert-amber";
                                                        icon = <ChefHat className="w-4 h-4" />;
                                                    } else if (item.status === 'ready') {
                                                        statusColorClass = "text-alert-green bg-alert-green/10 border-alert-green";
                                                        icon = <CheckCircle2 className="w-4 h-4" />;
                                                    }

                                                    return (
                                                        <li key={item.id} className="flex items-start justify-between font-mono text-sm">
                                                            <div className="flex items-center gap-3 text-zinc-300">
                                                                <span className="font-bold text-white">{item.qty}x</span>
                                                                {item.name}
                                                            </div>
                                                            <div className={`flex items-center gap-2 uppercase font-bold text-xs px-2 py-1 ${statusColorClass} rounded-sm`}>
                                                                {icon} {item.status}
                                                            </div>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </main>
        </div>
    );
}
