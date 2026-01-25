import { GithubIcon, DownloadIcon } from "lucide-react";
import { motion } from "framer-motion";

export default function HeroSection() {

    return (
        <>
            <motion.div className="fixed inset-0 overflow-hidden -z-20 pointer-events-none"
                initial={{ opacity: 0.4 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
            >
                <div className="absolute rounded-full top-80 left-2/5 -translate-x-1/2 size-130 bg-[#1E88E5] blur-[100px]" />
                <div className="absolute rounded-full top-80 right-0 -translate-x-1/2 size-130 bg-[#7C4DFF] blur-[100px]" />
                <div className="absolute rounded-full top-0 left-1/2 -translate-x-1/2 size-130 bg-[#00BFA5] blur-[100px]" />
            </motion.div>
            <motion.section className="flex flex-col items-center">
                <motion.div className="flex items-center gap-3 mt-32"
                    initial={{ y: -20, opacity: 0 }}
                    whileInView={{ y: 0, opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2, type: "spring", stiffness: 320, damping: 70, mass: 1 }}
                >
                    <p>Open Source & Free</p>
                    <span className="btn glass py-1 px-3 text-xs">
                        v0.1.0
                    </span>
                </motion.div>
                <motion.h1 className="text-center text-4xl/13 md:text-6xl/19 mt-4 font-semibold tracking-tight max-w-3xl"
                    initial={{ y: 50, opacity: 0 }}
                    whileInView={{ y: 0, opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ type: "spring", stiffness: 240, damping: 70, mass: 1 }}
                >
                    Board Game Platform
                </motion.h1>
                <motion.p className="text-center text-gray-100 text-base/7 max-w-md mt-6"
                    initial={{ y: 50, opacity: 0 }}
                    whileInView={{ y: 0, opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2, type: "spring", stiffness: 320, damping: 70, mass: 1 }}
                >
                    A web-based board game platform supporting single-player and LAN multiplayer modes. Play classic board games with friends anytime, anywhere.
                </motion.p>

                <motion.div className="flex flex-col md:flex-row max-md:w-full items-center gap-4 md:gap-3 mt-6"
                    initial={{ y: 50, opacity: 0 }}
                    whileInView={{ y: 0, opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ type: "spring", stiffness: 320, damping: 70, mass: 1 }}
                >
                    <a href="#download" className="btn max-md:w-full glass py-3 flex items-center justify-center gap-2">
                        <DownloadIcon className="size-4.5" />
                        Download
                    </a>
                    <a href="https://github.com/387809109/demo_boardgame" target="_blank" rel="noopener noreferrer" className="btn max-md:w-full glass flex items-center justify-center gap-2 py-3">
                        <GithubIcon className="size-4.5" />
                        View on GitHub
                    </a>
                </motion.div>
            </motion.section>
        </>
    );
}