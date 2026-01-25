import { DownloadIcon, GithubIcon } from "lucide-react";
import { motion } from "framer-motion";

export default function CallToAction() {
    return (
        <motion.div className="flex flex-col max-w-5xl mt-40 px-4 mx-auto items-center justify-center text-center py-16 rounded-xl glass" id="download"
            initial={{ y: 150, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ type: "spring", stiffness: 320, damping: 70, mass: 1 }}
        >
            <motion.h2 className="text-2xl md:text-4xl font-medium mt-2"
                initial={{ y: 80, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ type: "spring", stiffness: 280, damping: 70, mass: 1 }}
            >
                Ready to play?
            </motion.h2>
            <motion.p className="mt-4 text-sm/7 max-w-md"
                initial={{ y: 80, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ type: "spring", stiffness: 200, damping: 70, mass: 1 }}
            >
                Download the Board Game Platform and start playing with your friends today. It's free, open source, and easy to set up.
            </motion.p>
            <motion.div className="flex flex-col md:flex-row items-center gap-4 mt-8"
                initial={{ y: 80, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ type: "spring", stiffness: 280, damping: 70, mass: 1 }}
            >
                <a href="https://github.com/387809109/demo_boardgame/releases" target="_blank" rel="noopener noreferrer" className="btn glass transition-none flex items-center gap-2">
                    <DownloadIcon className="size-4" />
                    Download Latest Release
                </a>
                <a href="https://github.com/387809109/demo_boardgame" target="_blank" rel="noopener noreferrer" className="btn glass transition-none flex items-center gap-2">
                    <GithubIcon className="size-4" />
                    Star on GitHub
                </a>
            </motion.div>
        </motion.div>
    );
};