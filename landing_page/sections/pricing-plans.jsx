import SectionTitle from "@/components/section-title";
import { CheckIcon, CrownIcon, RocketIcon, ZapIcon } from "lucide-react";
import { motion } from "framer-motion";
import { useRef } from "react";

export default function PricingPlans() {
    const ref = useRef([]);
    const data = [
        {
            icon: RocketIcon,
            title: 'Starter',
            description: 'For individuals and small teams',
            price: '$19',
            buttonText: 'Get Started',
            features: [
                'Up to 10 projects',
                '10 AI tasks/month',
                'Basic text generation',
                'Simple chatbot access',
                'Email support only',
                'Community resources'
            ],
        },
        {
            icon: ZapIcon,
            title: 'Professional',
            description: 'For growing teams and startups',
            price: '$49',
            mostPopular: true,
            buttonText: 'Upgrade Now',
            features: [
                'Unlimited AI tasks',
                'API integration',
                'Text & image outputs',
                'Priority chat & email support',
                'Detailed analytics',
                'Team collaboration'
            ],
        },
        {
            icon: CrownIcon,
            title: 'Enterprise',
            description: 'For enterprises and agencies',
            price: '$149',
            buttonText: 'Contact Sales',
            features: [
                'Custom AI models',
                'Team access control',
                'Dedicated account manager',
                'Secure private API',
                'SLA uptime guarantee',
                '24/7 premium support'
            ],
        },
    ];

    return (
        <section className="mt-32">
            <SectionTitle
                title="Our Pricing Plans"
                description="A visual collection of our most recent works - each piece crafted with intention, emotion and style."
            />

            <div className='mt-12 flex flex-wrap items-center justify-center gap-6'>
                {data.map((item, index) => (
                    <motion.div key={index} className='group w-full max-w-80 glass p-6 rounded-xl hover:-translate-y-0.5'
                        initial={{ y: 150, opacity: 0 }}
                        whileInView={{ y: 0, opacity: 1 }}
                        viewport={{ once: true }}
                        transition={{ delay: `${index * 0.15}`, type: "spring", stiffness: 320, damping: 70, mass: 1 }}
                        ref={(el) => (ref.current[index] = el)}
                        onAnimationComplete={() => {
                            const card = ref.current[index];
                            if (card) {
                                card.classList.add("transition", "duration-300");
                            }
                        }}
                    >
                        <div className="flex items-center w-max ml-auto text-xs gap-2 glass rounded-full px-3 py-1">
                            <item.icon className='size-3.5' />
                            <span>{item.title}</span>
                        </div>
                        <h3 className='mt-4 text-2xl font-semibold'>
                            {item.price} <span className='text-sm font-normal'>/month</span>
                        </h3>
                        <p className='text-gray-200 mt-3'>{item.description}</p>
                        <button className={`mt-7 rounded-md w-full btn ${item.mostPopular ? 'bg-white text-gray-800' : 'glass'}`}>
                            {item.buttonText}
                        </button>
                        <div className='mt-6 flex flex-col'>
                            {item.features.map((feature, index) => (
                                <div key={index} className='flex items-center gap-2 py-2'>
                                    <div className='rounded-full glass border-0 p-1'>
                                        <CheckIcon className='size-3 text-white' strokeWidth={3} />
                                    </div>
                                    <p>{feature}</p>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                ))}
            </div>
        </section>
    );
}