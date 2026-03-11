'use client';
import { GithubIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";

export default function Footer() {
    const links = [
        { name: 'Features', href: '#features' },
        { name: 'How It Works', href: '#how-it-works' },
        { name: 'FAQ', href: '#faq' },
        { name: 'Download', href: '#download' },
    ];
    return (
        <motion.footer className="flex flex-col items-center px-4 md:px-16 lg:px-24 justify-center w-full pt-16 mt-40 glass border-0"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
        >
            <a href="/">
                <Image src='/assets/logo.svg' alt='Board Game Platform' className='h-8.5 w-auto' width={205} height={48} />
            </a>

            <div className="flex flex-wrap items-center justify-center gap-8 py-8">
                {links.map((link, index) => (
                    <Link key={index} href={link.href} className='transition hover:text-gray-300'>
                        {link.name}
                    </Link>
                ))}
            </div>
            <div className="flex items-center gap-6 pb-6">
                <a href="https://github.com/387809109/demo_boardgame" target="_blank" rel="noopener noreferrer" className="hover:-translate-y-0.5 text-gray-200 transition-all duration-300">
                    <GithubIcon />
                </a>
            </div>
            <hr className="w-full border-white/20 mt-6" />
            <div className="flex flex-col md:flex-row items-center w-full justify-between gap-4 py-4">
                <p>Open Source & Free to Use</p>
                <p>Board Game Platform © 2025 • MIT License</p>
            </div>
        </motion.footer>
    );
};