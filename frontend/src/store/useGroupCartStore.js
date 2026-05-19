import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getApiBase } from '../config/api';

// Cross-tab synchronization via BroadcastChannel
try {
  new BroadcastChannel('nexus_group_cart');
} catch {
  console.warn('BroadcastChannel not supported');
}

const generateShareCode = () =>
  Math.random().toString(36).slice(2, 8).toUpperCase();

const useGroupCartStore = create(
  persist(
    (set, get) => ({
      basket: null, // { shareCode, hostName, members: [], items: [], totalPrice }
      shareCode: null,
      isHost: false,
      userName: null,
      notification: null,

      createBasket: (hostName) => {
        const shareCode = generateShareCode();
        const basket = {
          shareCode,
          hostName,
          createdAt: new Date().toISOString(),
          items: [],
          members: [{ name: hostName, joinedAt: new Date().toISOString(), isHost: true, color: '#0c831f' }],
          totalPrice: 0,
          checkoutStatus: 'idle', // idle, pending, completed
          checkoutInitiatedBy: null,
          confirmations: []
        };
        set({ basket, shareCode, isHost: true, userName: hostName });
        broadcastUpdate(basket);
        return shareCode;
      },

      joinBasket: (shareCode, guestName) => {
        set({ userName: guestName, shareCode });
        get().fetchBasket(shareCode);
      },

      fetchBasket: async (code) => {
        try {
          const res = await fetch(`${getApiBase()}/api/group-cart/${code}`);
          const basket = await res.json();
          if (basket) {
            const currentUserName = get().userName;
            if (currentUserName) {
              const existingMember = basket.members?.find(m => m.name === currentUserName);
              if (!existingMember) {
                const colors = ['#0c831f', '#1d4ed8', '#7c3aed', '#db2777', '#ea580c', '#e11d48'];
                const randomColor = colors[Math.floor(Math.random() * colors.length)];
                if (!basket.members) basket.members = [];
                basket.members.push({
                  name: currentUserName,
                  joinedAt: new Date().toISOString(),
                  isHost: false,
                  color: randomColor
                });
                // Initialize checkout fields if missing in old DB records
                if (!basket.checkoutStatus) basket.checkoutStatus = 'idle';
                if (!basket.confirmations) basket.confirmations = [];
                
                broadcastUpdate(basket);
              }
            }
            set({ basket, shareCode: code });
          }
        } catch (e) {
          console.error("NEXUS: Failed to fetch basket", e);
        }
      },

      initiateCheckout: () => {
        const { basket, userName } = get();
        if (!basket || basket.checkoutStatus !== 'idle') return;

        const newBasket = { 
          ...basket, 
          checkoutStatus: 'pending', 
          checkoutInitiatedBy: userName,
          confirmations: [userName] // Initiator auto-confirms
        };
        set({ basket: newBasket });
        broadcastUpdate(newBasket);
      },

      confirmCheckout: () => {
        const { basket, userName } = get();
        if (!basket || basket.checkoutStatus !== 'pending') return;
        if (basket.confirmations.includes(userName)) return;

        const newConfirmations = [...basket.confirmations, userName];
        const allConfirmed = newConfirmations.length === basket.members.length;
        
        const newBasket = { 
          ...basket, 
          confirmations: newConfirmations,
          checkoutStatus: allConfirmed ? 'completed' : 'pending'
        };
        set({ basket: newBasket });
        broadcastUpdate(newBasket);
      },

      cancelCheckout: () => {
        const { basket } = get();
        if (!basket) return;

        const newBasket = { 
          ...basket, 
          checkoutStatus: 'idle', 
          checkoutInitiatedBy: null,
          confirmations: []
        };
        set({ basket: newBasket });
        broadcastUpdate(newBasket);
      },

      addItem: (product) => {
        const { basket, userName } = get();
        if (!basket) return;

        const existingIndex = basket.items.findIndex(i => i.product.id === product.id);
        let newItems;

        if (existingIndex > -1) {
          newItems = [...basket.items];
          newItems[existingIndex] = { 
            ...newItems[existingIndex], 
            quantity: newItems[existingIndex].quantity + 1 
          };
        } else {
          newItems = [...basket.items, { 
            product, 
            quantity: 1, 
            addedBy: userName,
            addedAt: new Date().toISOString() 
          }];
        }

        const totalPrice = newItems.reduce((acc, item) => {
          const price = typeof item.product.price === 'string' 
            ? parseFloat(item.product.price.replace('₹', '')) 
            : item.product.price;
          return acc + (price * item.quantity);
        }, 0);

        const newBasket = { ...basket, items: newItems, totalPrice };
        set({ basket: newBasket });
        broadcastUpdate(newBasket);
        set({ notification: { message: `Added ${product.name}`, type: 'success' } });
        setTimeout(() => set({ notification: null }), 3000);
      },

      removeItem: (productId) => {
        const { basket } = get();
        if (!basket) return;

        const newItems = basket.items
          .map(item => item.product.id === productId ? { ...item, quantity: item.quantity - 1 } : item)
          .filter(item => item.quantity > 0);

        const totalPrice = newItems.reduce((acc, item) => {
          const price = typeof item.product.price === 'string' 
            ? parseFloat(item.product.price.replace('₹', '')) 
            : item.product.price;
          return acc + (price * item.quantity);
        }, 0);

        const newBasket = { ...basket, items: newItems, totalPrice };
        set({ basket: newBasket });
        broadcastUpdate(newBasket);
      },

      syncFromRemote: (basket) => set({ basket }),

      leaveBasket: () => {
        set({ basket: null, shareCode: null, isHost: false });
      }
    }),
    { name: 'nexus-group-cart' }
  )
);

// Helper to broadcast via WS and save to DB
function broadcastUpdate(basket) {
  // Save to DB
  fetch(`${getApiBase()}/api/group-cart/${basket.shareCode}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(basket)
  }).catch(err => console.error("Failed to save basket", err));

  // Sync via WS
  import('./useSearchStore').then(mod => {
     mod.default.getState().syncGroupCart(basket);
  });
}

export default useGroupCartStore;
