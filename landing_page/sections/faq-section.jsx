import SectionTitle from '@/components/section-title';
import { ChevronDownIcon } from 'lucide-react';
import { useState } from 'react';
import { motion } from "framer-motion";

export default function FaqSection() {
    const [isOpen, setIsOpen] = useState(false);
    const data = [
        {
            question: 'Is this platform free to use?',
            answer: 'Yes! The Board Game Platform is completely free and open source. You can download, use, and even modify it as you like.',
        },
        {
            question: 'What games are currently available?',
            answer: 'We are starting with popular games like UNO and Werewolf. More games will be added over time. You can also contribute your own game implementations!',
        },
        {
            question: 'Do I need to install anything?',
            answer: 'The platform runs entirely in your web browser. Just download and run the server, then open the provided URL in any modern browser.',
        },
        {
            question: 'How does LAN multiplayer work?',
            answer: 'One player runs the server on their machine. Other players connect by entering the host\'s local IP address. All players must be on the same network.',
        },
        {
            question: 'Can I play alone?',
            answer: 'Yes! Single-player mode is available with AI opponents. You can adjust the AI difficulty to match your skill level.',
        },
        {
            question: 'How can I contribute to the project?',
            answer: 'The project is open source on GitHub. You can contribute by submitting bug reports, feature requests, or pull requests for new games and improvements.',
        },
    ];

    return (
        <section className='mt-32' id="faq">
            <SectionTitle title="FAQ" description="Common questions about the Board Game Platform answered here." />
            <div className='mx-auto mt-12 space-y-4 w-full max-w-xl'>
                {data.map((item, index) => (
                    <motion.div key={index} className='flex flex-col glass rounded-md'
                        initial={{ y: 150, opacity: 0 }}
                        whileInView={{ y: 0, opacity: 1 }}
                        viewport={{ once: true }}
                        transition={{ delay: `${index * 0.15}`, type: "spring", stiffness: 320, damping: 70, mass: 1 }}
                    >
                        <h3 className='flex cursor-pointer hover:bg-white/10 transition items-start justify-between gap-4 p-4 font-medium' onClick={() => setIsOpen(isOpen === index ? null : index)}>
                            {item.question}
                            <ChevronDownIcon className={`size-5 transition-all shrink-0 duration-400 ${isOpen === index ? 'rotate-180' : ''}`} />
                        </h3>
                        <p className={`px-4 text-sm/6 transition-all duration-400 overflow-hidden ${isOpen === index ? 'pt-2 pb-4 max-h-80' : 'max-h-0'}`}>{item.answer}</p>
                    </motion.div>
                ))}
            </div>
        </section>
    );
}