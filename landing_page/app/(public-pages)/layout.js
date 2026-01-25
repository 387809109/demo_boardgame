import Footer from '@/components/footer';
import Navbar from '@/components/navbar';

export const metadata = {
    title: 'Board Game Platform - Play Classic Board Games Online',
    description: 'A web-based board game platform supporting single-player and LAN multiplayer modes. Play classic board games like UNO and Werewolf with friends.',
    appleWebApp: {
        title: 'Board Game Platform',
    },
};

export default function Layout({ children }) {
    return (
        <>
            <Navbar />
            {children}
            <Footer />
        </>
    );
}
