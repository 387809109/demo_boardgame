import SectionTitle from "@/components/section-title";
import { UserIcon, UsersIcon, Gamepad2Icon, WifiIcon, MonitorIcon, SettingsIcon } from "lucide-react";
import { motion } from "framer-motion";
import { useRef } from "react";

export default function Features() {

    const refs = useRef([]);

    const featuresData = [
        {
            icon: UserIcon,
            title: "Single Player Mode",
            description: "Play against AI opponents with adjustable difficulty levels.",
        },
        {
            icon: UsersIcon,
            title: "LAN Multiplayer",
            description: "Connect with friends on the same network for local multiplayer fun.",
        },
        {
            icon: Gamepad2Icon,
            title: "Multiple Games",
            description: "Enjoy various classic board games like UNO, Werewolf, and more.",
        },
        {
            icon: WifiIcon,
            title: "Real-time Sync",
            description: "WebSocket-powered real-time game state synchronization.",
        },
        {
            icon: MonitorIcon,
            title: "Cross-platform",
            description: "Play on any device with a modern web browser.",
        },
        {
            icon: SettingsIcon,
            title: "Customizable",
            description: "Adjust game rules and settings to your preferences.",
        }
    ];

    return (
        <section className="mt-32" id="features">
            <SectionTitle
                title="Platform Features"
                description="Everything you need for the ultimate board game experience with friends and family."
            />

            <div className="flex flex-wrap items-center justify-center gap-6 mt-10 px-6">
                {featuresData.map((feature, index) => (
                    <motion.div
                        key={index}
                        ref={(el) => (refs.current[index] = el)}
                        className="hover:-translate-y-0.5 p-6 rounded-xl space-y-4 glass max-w-80 w-full"
                        initial={{ y: 150, opacity: 0 }}
                        whileInView={{ y: 0, opacity: 1 }}
                        viewport={{ once: true }}
                        transition={{
                            delay: index * 0.15,
                            type: "spring",
                            stiffness: 320,
                            damping: 70,
                            mass: 1
                        }}
                        onAnimationComplete={() => {
                            const card = refs.current[index];
                            if (card) {
                                card.classList.add("transition", "duration-300");
                            }
                        }}
                    >
                        <feature.icon className="size-8.5" />
                        <h3 className="text-base font-medium text-white">
                            {feature.title}
                        </h3>
                        <p className="text-gray-100 line-clamp-2 pb-2">
                            {feature.description}
                        </p>
                    </motion.div>
                ))}
            </div>
        </section>
    );
}
