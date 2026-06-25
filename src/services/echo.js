import Echo from 'laravel-echo'
import Pusher from 'pusher-js'

window.Pusher = Pusher

// TLS follows the scheme: https -> secure wss, anything else -> plain ws.
// Lets the same build target an https domain (wss/443) or a raw http IP (ws/9011).
const useTLS = (import.meta.env.VITE_REVERB_SCHEME ?? 'https') === 'https'

const echo = new Echo({
    broadcaster: 'reverb',
    key: import.meta.env.VITE_REVERB_APP_KEY,
    wsHost: import.meta.env.VITE_REVERB_HOST,
    wsPort: import.meta.env.VITE_REVERB_PORT ?? 8080,
    wssPort: import.meta.env.VITE_REVERB_PORT ?? 8080,
    forceTLS: useTLS,
    enabledTransports: useTLS ? ['wss'] : ['ws'],
})

export default echo