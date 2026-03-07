"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";

export default function UnifiedLogin() {
    const router = useRouter();
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        
        // Owner PIN
        if (password === "owner123" || password === "admin") {
            localStorage.setItem('owner_auth', 'true');
            router.push("/dashboard");
        } 
        // Kitchen PIN
        else if (password === "kitchen123") {
            localStorage.setItem('kds_auth', 'true');
            router.push("/kitchen");
        } 
        // Invalid
        else {
            setError("INCORRECT PIN. ACCESS DENIED.");
            setPassword("");
        }
    };

    return (
        <div className="min-h-screen bg-black flex items-center justify-center p-4 selection:bg-white selection:text-black">
            <form onSubmit={handleLogin} className="w-full max-w-lg border-2 border-zinc-800 p-8 flex flex-col items-start gap-8 shadow-[0_0_50px_rgba(0,0,0,0.5)] bg-[#050505]">
                <div>
                    <h1 className="text-white text-4xl font-black uppercase tracking-tighter">
                        QR Connect <span className="text-zinc-500">/ Login</span>
                    </h1>
                    <p className="text-zinc-400 mt-2 font-mono uppercase text-sm border-l-4 border-white pl-3">
                        Enter assigned PIN to route to correct dashboard
                    </p>
                </div>

                <div className="w-full relative">
                    <input
                        type="password"
                        placeholder="ENTER PIN"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-black border-2 border-zinc-700 text-white p-4 font-mono uppercase text-2xl tracking-widest focus:outline-none focus:border-white focus:ring-0 transition-colors placeholder:text-zinc-700"
                        autoFocus
                    />
                    {error && (
                        <p className="text-red-500 font-mono uppercase text-xs mt-3 flex items-center gap-2 bg-red-500/10 p-2 border border-red-500/20">
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
                
                <div className="w-full flex justify-between text-xs font-mono text-zinc-600 mt-4">
                    <span>Kitchen PIN: kitchen123</span>
                    <span>Owner PIN: admin</span>
                </div>
            </form>
        </div>
    );
}
