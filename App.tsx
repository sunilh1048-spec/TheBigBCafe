
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import { GoogleGenAI, LiveServerMessage, Modality, Type, FunctionDeclaration } from '@google/genai';
import { supabase } from './supabase';
import { MENU_DATA as INITIAL_MENU_DATA } from './data';
import { MenuCategory, MenuItem } from './types';

interface CartItem extends MenuItem {
  quantity: number;
  selectedVariant?: string;
  finalPrice: number;
}

interface OrderRecord {
  orderId: string;
  timestamp: string;
  date: string;
  createdAt: number;
  table: number;
  customerName: string;
  customerPhone?: string;
  items: string;
  itemList: CartItem[]; 
  total: number;
  status: 'Preparing' | 'Ready' | 'Served' | 'Paid';
  isNew?: boolean;
}

interface FeedbackRecord {
  id: string;
  customerName: string;
  rating: number;
  comment: string;
  timestamp: string;
  createdAt: number;
}

// --- Audio Utility Functions ---
function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const STORAGE_KEY = 'bigbellyz_menu_v3';
const ORDERS_KEY = 'bigbellyz_orders_v2';
const FEEDBACK_KEY = 'bigbellyz_feedback_v1';

interface MenuItemCardProps {
  item: MenuItem;
  animatingItemId: string | null;
  addToCart: (item: MenuItem, variant?: { label: string; price: string }, qty?: number) => void;
}

const MenuItemCard: React.FC<MenuItemCardProps> = ({ item, animatingItemId, addToCart }) => {
  const [quantity, setQuantity] = useState(1);

  return (
    <div 
      className={`bg-white p-8 rounded-[3rem] border relative flex flex-col justify-between transition-all hover:border-tan hover:shadow-2xl ${
        animatingItemId === `${item.name}-default` ? 'animate-item-pop border-tan ring-4 ring-tan/10' : 'border-stone-100'
      }`}
    >
      <div>
        <div className="flex justify-between items-start gap-4 mb-4">
          <h3 className="text-xl font-bold text-stone-800 leading-tight tracking-tight">{item.name}</h3>
          <span className="text-lg font-black text-stone-900 shrink-0">₹{item.price || item.priceVariant?.[0].price}</span>
        </div>
        {item.description && <p className="text-stone-400 text-xs italic leading-relaxed">{item.description}</p>}
      </div>
      
      <div className="mt-8 pt-6 border-t border-stone-50 space-y-4">
        <div className="flex items-center justify-between bg-stone-50 p-3 rounded-2xl">
          <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">Quantity</span>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setQuantity(q => Math.max(1, q - 1))}
              className="w-8 h-8 rounded-full bg-white border border-stone-100 flex items-center justify-center text-stone-400 hover:text-tan hover:border-tan transition-all shadow-sm"
              disabled={quantity <= 1}
            >
              <i className="fas fa-minus text-[10px]"></i>
            </button>
            <span className="text-sm font-bold text-stone-900 w-4 text-center">{quantity}</span>
            <button 
              onClick={() => setQuantity(q => Math.min(20, q + 1))}
              className="w-8 h-8 rounded-full bg-white border border-stone-100 flex items-center justify-center text-stone-400 hover:text-tan hover:border-tan transition-all shadow-sm"
              disabled={quantity >= 20}
            >
              <i className="fas fa-plus text-[10px]"></i>
            </button>
          </div>
        </div>

        {item.priceVariant ? (
          <div className="flex flex-wrap gap-3">
            {item.priceVariant.map((v, vi) => (
              <button 
                key={vi} 
                onClick={() => addToCart(item, v, quantity)} 
                className="flex-1 px-4 py-3 bg-stone-50 hover:bg-tan hover:text-white rounded-2xl text-[10px] font-black uppercase transition-all tracking-wider"
              >
                {v.label} <span className="block opacity-60">₹{v.price.replace('/-', '')}</span>
              </button>
            ))}
          </div>
        ) : (
          <button 
            onClick={() => addToCart(item, undefined, quantity)} 
            className="w-full py-4.5 bg-stone-900 text-white rounded-[2rem] text-[11px] font-black uppercase tracking-[0.2em] hover:bg-tan shadow-xl active:scale-95 transition-all"
          >
            Add to Tray
          </button>
        )}
      </div>
    </div>
  );
};

const App: React.FC = () => {
  // --- Persistence ---
  const [menu, setMenu] = useState<MenuCategory[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : INITIAL_MENU_DATA;
  });

  const [orderHistory, setOrderHistory] = useState<OrderRecord[]>(() => {
    const saved = localStorage.getItem(ORDERS_KEY);
    return saved ? JSON.parse(saved) : [];
  });

  const [feedbackHistory, setFeedbackHistory] = useState<FeedbackRecord[]>(() => {
    const saved = localStorage.getItem(FEEDBACK_KEY);
    return saved ? JSON.parse(saved) : [];
  });

  // --- Supabase Sync ---
  useEffect(() => {
    const fetchInitialData = async () => {
      if (!supabase) return;
      try {
        // Fetch Orders
        const { data: ordersData, error: ordersError } = await supabase
          .from('orders')
          .select('*')
          .order('createdAt', { ascending: false });
        
        if (ordersData && !ordersError) {
          setOrderHistory(ordersData);
        }

        // Fetch Feedback
        const { data: feedbackData, error: feedbackError } = await supabase
          .from('feedback')
          .select('*')
          .order('createdAt', { ascending: false });
        
        if (feedbackData && !feedbackError) {
          setFeedbackHistory(feedbackData);
        }

        // Fetch Menu
        const { data: menuData, error: menuError } = await supabase
          .from('menu_config')
          .select('config')
          .limit(1)
          .single();
        
        if (menuData && !menuError && menuData.config) {
          setMenu(menuData.config);
        }
      } catch (err) {
        console.error('Error fetching data from Supabase:', err);
      }
    };

    fetchInitialData();
  }, []);

  const syncMenuToSupabase = async (newMenu: MenuCategory[]) => {
    if (!supabase) return;
    try {
      const { error } = await supabase
        .from('menu_config')
        .upsert({ id: 1, config: newMenu }, { onConflict: 'id' });
      if (error) console.error('Error syncing menu to Supabase:', error);
    } catch (err) {
      console.error('Supabase menu sync error:', err);
    }
  };

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(menu));
    syncMenuToSupabase(menu);
  }, [menu]);

  useEffect(() => {
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orderHistory));
  }, [orderHistory]);

  useEffect(() => {
    localStorage.setItem(FEEDBACK_KEY, JSON.stringify(feedbackHistory));
  }, [feedbackHistory]);

  // --- UI State ---
  const [isAdminView, setIsAdminView] = useState(false);
  const [adminTab, setAdminTab] = useState<'kitchen' | 'dashboard' | 'editor' | 'history' | 'feedback'>('kitchen');
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  // --- Consumer UI State ---
  const [activeCategory, setActiveCategory] = useState<string>(menu[0].id);
  const [selectedTable, setSelectedTable] = useState<number | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [showTablePicker, setShowTablePicker] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showTrayModal, setShowTrayModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackHover, setFeedbackHover] = useState(0);
  const [isFeedbackSubmitting, setIsFeedbackSubmitting] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);

  const [billOrder, setBillOrder] = useState<OrderRecord | null>(null);
  const [tempCustomerName, setTempCustomerName] = useState('');
  const [tempTable, setTempTable] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [checkInPulse, setCheckInPulse] = useState(false);
  
  const [cart, setCart] = useState<CartItem[]>([]);
  const [lastOrder, setLastOrder] = useState<OrderRecord | null>(null);
  const [pendingVoiceItem, setPendingVoiceItem] = useState<{ item: MenuItem, variant?: { label: string; price: string }, quantity: number } | null>(null);
  
  const [animatingItemId, setAnimatingItemId] = useState<string | null>(null);
  const [isCartAnimating, setIsCartAnimating] = useState(false);
  
  // --- Dashboard Logic ---
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [isLoadingInsight, setIsLoadingInsight] = useState(false);
  const [isSavingToSheets, setIsSavingToSheets] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [googleScriptUrl, setGoogleScriptUrl] = useState<string>(() => {
    return localStorage.getItem('bigbellyz_google_script_url') || '';
  });

  useEffect(() => {
    localStorage.setItem('bigbellyz_google_script_url', googleScriptUrl);
  }, [googleScriptUrl]);

  // --- Live API State ---
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  const sessionRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioInputContextRef = useRef<AudioContext | null>(null);
  const audioOutputContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const [editingItem, setEditingItem] = useState<{ categoryId: string, itemIndex: number | null } | null>(null);
  const [itemForm, setItemForm] = useState<MenuItem>({ name: '', description: '', price: '', priceVariant: [] });

  const handleEditItem = (categoryId: string, itemIndex: number | null) => {
    setEditingItem({ categoryId, itemIndex });
    if (itemIndex !== null) {
      const category = menu.find(c => c.id === categoryId);
      if (category) {
        setItemForm({ ...category.items[itemIndex] });
      }
    } else {
      setItemForm({ name: '', description: '', price: '', priceVariant: [] });
    }
  };

  const saveMenuItem = () => {
    if (!editingItem) return;
    const newMenu = [...menu];
    const categoryIndex = newMenu.findIndex(c => c.id === editingItem.categoryId);
    if (categoryIndex === -1) return;

    if (editingItem.itemIndex === null) {
      newMenu[categoryIndex].items.push(itemForm);
    } else {
      newMenu[categoryIndex].items[editingItem.itemIndex] = itemForm;
    }

    setMenu(newMenu);
    setEditingItem(null);
  };

  const deleteMenuItem = (categoryId: string, itemIndex: number) => {
    if (!window.confirm('Are you sure you want to delete this item?')) return;
    const newMenu = [...menu];
    const categoryIndex = newMenu.findIndex(c => c.id === categoryId);
    if (categoryIndex === -1) return;
    newMenu[categoryIndex].items.splice(itemIndex, 1);
    setMenu(newMenu);
  };

  // --- Analytics & Search Logic ---
  const analytics = useMemo(() => {
    const paidOrders = orderHistory.filter(o => o.status === 'Paid');
    const totalRevenue = paidOrders.reduce((acc, o) => acc + o.total, 0);
    
    const itemCounts: { [key: string]: { count: number, revenue: number } } = {};
    paidOrders.forEach(order => {
      order.itemList.forEach(item => {
        const key = `${item.name}${item.selectedVariant ? ` (${item.selectedVariant})` : ''}`;
        if (!itemCounts[key]) itemCounts[key] = { count: 0, revenue: 0 };
        itemCounts[key].count += item.quantity;
        itemCounts[key].revenue += (item.finalPrice * item.quantity);
      });
    });

    const mostSold = Object.entries(itemCounts)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const activeOrders = orderHistory.filter(o => o.status !== 'Paid' && o.status !== 'Served').length;
    const avgRating = feedbackHistory.length > 0 ? feedbackHistory.reduce((a, b) => a + b.rating, 0) / feedbackHistory.length : 0;

    return { totalRevenue, activeOrders, totalCount: orderHistory.length, avgRating, mostSold, paidCount: paidOrders.length };
  }, [orderHistory, feedbackHistory]);

  const filteredMenu = useMemo(() => {
    if (!searchQuery.trim()) return menu;
    const query = searchQuery.toLowerCase();
    return menu.map(cat => ({
      ...cat,
      items: cat.items.filter(item => 
        item.name.toLowerCase().includes(query) || 
        (item.description && item.description.toLowerCase().includes(query)) ||
        cat.title.toLowerCase().includes(query)
      )
    })).filter(cat => cat.items.length > 0);
  }, [menu, searchQuery]);

  interface SearchSuggestion {
    label: string;
    type: 'category' | 'item';
    id: string; // category id
    itemName?: string;
  }

  const searchSuggestions = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) return [];
    const query = searchQuery.toLowerCase();
    const suggestions: SearchSuggestion[] = [];

    menu.forEach(cat => {
      if (cat.title.toLowerCase().includes(query)) {
        suggestions.push({ label: cat.title, type: 'category', id: cat.id });
      }
    });

    menu.forEach(cat => {
      cat.items.forEach(item => {
        if (item.name.toLowerCase().includes(query) || (item.description && item.description.toLowerCase().includes(query))) {
          suggestions.push({ label: item.name, type: 'item', id: cat.id, itemName: item.name });
        }
      });
    });

    const unique = suggestions.filter((v, i, a) => a.findIndex(t => t.label === v.label) === i);
    return unique.slice(0, 8);
  }, [menu, searchQuery]);

  const cartTotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + (item.finalPrice * item.quantity), 0);
  }, [cart]);

  const generateFeedbackInsights = async () => {
    if (feedbackHistory.length === 0) {
      setAiInsight("Not enough feedback data yet to generate insights.");
      return;
    }
    setIsLoadingInsight(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const feedbackText = feedbackHistory.map(f => `Rating: ${f.rating}, Comment: ${f.comment}`).join('\n');
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Analyze the following customer feedback for 'The Big Bellyz' restaurant and suggest 3-5 key improvements. Be professional and constructive. Summarize common complaints and praises.\n\nFeedback:\n${feedbackText}`,
      });
      setAiInsight(response.text || "Could not generate insights at this moment.");
    } catch (e) {
      setAiInsight("Failed to generate AI insights. Check your connection or API key.");
    } finally {
      setIsLoadingInsight(false);
    }
  };

  const groupedOrders = useMemo(() => {
    const active = orderHistory.filter(o => o.status !== 'Paid');
    const groups: { [key: number]: OrderRecord[] } = {};
    active.forEach(o => { 
      if (!groups[o.table]) groups[o.table] = []; 
      groups[o.table].push(o); 
    });
    return Object.keys(groups).map(k => {
      const tableOrders = groups[parseInt(k)];
      const sortedTableOrders = [...tableOrders].sort((a, b) => b.createdAt - a.createdAt);
      return { 
        table: parseInt(k), 
        orders: sortedTableOrders, 
        latestAtTable: sortedTableOrders[0]?.createdAt || 0,
        customerName: sortedTableOrders[0]?.customerName || 'Guest'
      };
    }).sort((a, b) => b.latestAtTable - a.latestAtTable);
  }, [orderHistory]);

  const stats = analytics;

  // --- Handlers ---
  const updateStatus = useCallback(async (orderId: string, status: OrderRecord['status']) => {
    setUpdatingOrderId(orderId);
    
    // Update Supabase
    if (supabase) {
      try {
        await supabase
          .from('orders')
          .update({ status, isNew: false })
          .eq('orderId', orderId);
      } catch (err) {
        console.error('Error updating status in Supabase:', err);
      }
    }

    setTimeout(() => {
      setOrderHistory(prev => prev.map(order => order.orderId === orderId ? { ...order, status, isNew: false } : order));
      setTimeout(() => setUpdatingOrderId(null), 1000);
    }, 200);
  }, []);

  const handleExportToExcel = useCallback(() => {
    if (orderHistory.length === 0) return;
    const data = orderHistory.map(o => ({ 'ID': o.orderId, 'Table': o.table, 'Customer': o.customerName, 'Items': o.items, 'Total': o.total.toFixed(0), 'Status': o.status }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Orders");
    XLSX.writeFile(wb, "BigBellyz_Kitchen.xlsx");
  }, [orderHistory]);

  const handleSaveToGoogleSheets = useCallback(async () => {
    if (orderHistory.length === 0) return;
    
    if (!googleScriptUrl) {
      alert("Please provide a Google Apps Script Web App URL in the field below.");
      return;
    }

    setIsSavingToSheets(true);
    setSaveStatus('idle');
    
    try {
      const payload = {
        orders: orderHistory.map(o => ({
          date: o.date,
          timestamp: o.timestamp,
          orderId: o.orderId,
          table: o.table,
          customer: o.customerName,
          phone: o.customerPhone || 'N/A',
          items: o.items.map(i => `${i.qty}x ${i.name}${i.variant ? ` (${i.variant})` : ''}`).join(', '),
          total: o.total,
          status: o.status
        }))
      };

      await fetch(googleScriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      console.error("Error saving to Google Sheets:", error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } finally {
      setIsSavingToSheets(false);
    }
  }, [orderHistory, googleScriptUrl]);

  const addToCart = useCallback((item: MenuItem, variant?: { label: string; price: string }, qty: number = 1) => {
    const variantLabel = variant ? variant.label : undefined;
    const priceStr = variant ? variant.price : item.price;
    const price = parseInt(priceStr.replace('/-', '').replace(',', '').trim()) || 0;
    
    setAnimatingItemId(`${item.name}-${variantLabel || 'default'}`);
    setIsCartAnimating(true);
    setTimeout(() => setAnimatingItemId(null), 400);
    setTimeout(() => setIsCartAnimating(false), 600);

    setCart(prev => {
      const existing = prev.find(i => i.name === item.name && i.selectedVariant === variantLabel);
      if (existing) return prev.map(i => (i.name === item.name && i.selectedVariant === variantLabel) ? { ...i, quantity: i.quantity + qty } : i);
      return [...prev, { ...item, quantity: qty, selectedVariant: variantLabel, finalPrice: price }];
    });
    setShowTrayModal(true);
  }, []);

  const finalizeOrder = useCallback(async () => {
    const { cart: currentCart, selectedTable: currentTable, customerName: currentName, customerPhone: currentPhone } = stateRef.current;
    if (!currentTable || !currentName || currentCart.length === 0) return null;
    
    const now = new Date();
    const orderId = `ORD-${Date.now().toString().slice(-4)}`;
    const total = currentCart.reduce((acc, i) => acc + (i.finalPrice * i.quantity), 0);
    const order: OrderRecord = {
      orderId, timestamp: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), date: now.toLocaleDateString(),
      createdAt: now.getTime(), table: currentTable, customerName: currentName, customerPhone: currentPhone, itemList: [...currentCart],
      items: currentCart.map(i => `${i.name}${i.selectedVariant ? ` (${i.selectedVariant})` : ''} x${i.quantity}`).join(', '),
      total, status: 'Preparing', isNew: true
    };
    
    // Save to Supabase
    if (supabase) {
      try {
        await supabase.from('orders').insert([order]);
      } catch (err) {
        console.error('Error saving order to Supabase:', err);
      }
    }

    setOrderHistory(prev => [order, ...prev]);
    setLastOrder(order);
    setCart([]);
    setShowConfirmModal(false);
    setShowSuccessModal(true);
    return orderId;
  }, []);

  const submitFeedback = useCallback(async (rating: number, comment: string) => {
    const { customerName: currentName } = stateRef.current;
    setIsFeedbackSubmitting(true);
    
    const newFeedback: FeedbackRecord = {
      id: `FB-${Date.now().toString().slice(-4)}`,
      customerName: currentName || 'Anonymous Guest',
      rating,
      comment: comment || 'No comment provided.',
      timestamp: new Date().toLocaleString(),
      createdAt: Date.now()
    };

    // Save to Supabase
    if (supabase) {
      try {
        await supabase.from('feedback').insert([newFeedback]);
      } catch (err) {
        console.error('Error saving feedback to Supabase:', err);
      }
    }

    setTimeout(() => {
      setFeedbackHistory(prev => [newFeedback, ...prev]);
      setIsFeedbackSubmitting(false);
      setFeedbackSuccess(true);
      
      setTimeout(() => {
        setFeedbackSuccess(false);
        setShowFeedbackModal(false);
        setFeedbackRating(0);
      }, 2000);
    }, 800);
    
    return true;
  }, []);

  const scrollToCategory = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) {
      window.scrollTo({ top: el.offsetTop - 120, behavior: 'smooth' });
    }
    setActiveCategory(id);
  }, []);

  // --- State Reference for AI Session ---
  const stateRef = useRef({
    cart, customerName, customerPhone, selectedTable, orderHistory, menu, 
    pendingVoiceItem, addToCart, finalizeOrder, setCart, submitFeedback,
    scrollToCategory
  });

  useEffect(() => {
    stateRef.current = { 
      cart, customerName, customerPhone, selectedTable, orderHistory, menu, 
      pendingVoiceItem, addToCart, finalizeOrder, setCart, submitFeedback,
      scrollToCategory
    };
  }, [cart, customerName, customerPhone, selectedTable, orderHistory, menu, pendingVoiceItem, addToCart, finalizeOrder, submitFeedback, scrollToCategory]);

  const cleanupLiveSession = useCallback(() => {
    setIsLiveActive(false); setIsConnecting(false); setIsSpeaking(false);
    if (sessionRef.current) { try { sessionRef.current.close(); } catch (e) {} sessionRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    audioSourcesRef.current.forEach(s => { try { s.stop(); } catch (e) {} }); audioSourcesRef.current.clear();
    if (audioInputContextRef.current && audioInputContextRef.current.state !== 'closed') audioInputContextRef.current.close().catch(() => {});
    if (audioOutputContextRef.current && audioOutputContextRef.current.state !== 'closed') audioOutputContextRef.current.close().catch(() => {});
  }, []);

  const prepareItemByVoice = useCallback((name: string, variantLabel?: string, quantity: number = 1) => {
    const { menu: currentMenu, scrollToCategory: scrollFn } = stateRef.current;
    const flatMenu = currentMenu.flatMap(c => c.items.map(i => ({ ...i, catId: c.id })));
    
    const searchName = name.toLowerCase().replace(/\s+/g, '');
    const found = flatMenu.find(i => i.name.toLowerCase().replace(/\s+/g, '').includes(searchName));
    
    if (!found) return { error: `Couldn't find "${name}" on the menu.` };
    
    // Navigate visually
    scrollFn(found.catId);
    setAnimatingItemId(`${found.name}-default`);
    setTimeout(() => setAnimatingItemId(null), 3000);

    let matchedVariant = undefined;
    if (variantLabel && found.priceVariant) {
      matchedVariant = found.priceVariant.find(v => v.label.toLowerCase().includes(variantLabel.toLowerCase()));
    }
    
    setPendingVoiceItem({ item: found, variant: matchedVariant, quantity });
    return { success: `Found ${quantity}x ${found.name}. Shall I add it to your tray?` };
  }, []);

  const toggleLiveAPI = async () => {
    if (isLiveActive || isConnecting) { cleanupLiveSession(); return; }
    setIsConnecting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const inCtx = new AudioContext({ sampleRate: 16000 });
      const outCtx = new AudioContext({ sampleRate: 24000 });
      audioInputContextRef.current = inCtx; audioOutputContextRef.current = outCtx;
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const menuSummary = stateRef.current.menu.map(cat => 
        `${cat.title}: ${cat.items.map(i => `${i.name}${i.description ? ` (${i.description})` : ''}`).join(', ')}`
      ).join('; ');
      
      const tools: FunctionDeclaration[] = [
        { 
          name: 'setCustomerInfo', 
          description: 'Register the user name, table number and phone number.',
          parameters: { 
            type: Type.OBJECT, 
            properties: { 
              name: { type: Type.STRING }, 
              tableNumber: { type: Type.NUMBER },
              phoneNumber: { type: Type.STRING }
            }, 
            required: ['name', 'tableNumber'] 
          } 
        },
        { 
          name: 'prepareItemForTray', 
          description: 'Identify an item from the menu and prepare it to be added to tray. Always ask for confirmation after this.',
          parameters: { 
            type: Type.OBJECT, 
            properties: { 
              itemName: { type: Type.STRING }, 
              variant: { type: Type.STRING, description: 'Optional size or type e.g. Small, Medium, Brown bread etc.' }, 
              quantity: { type: Type.NUMBER } 
            }, 
            required: ['itemName'] 
          } 
        },
        { name: 'confirmItemAddition', description: 'Confirm and actually add the previously prepared item to the tray.' }, 
        { name: 'cancelItemAddition', description: 'Cancel the pending item addition.' }, 
        { name: 'checkTrayStatus', description: 'List items currently in the tray.' },
        { name: 'placeFinalOrder', description: 'Finalize the order and send it to the kitchen.' }
      ];

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: async () => {
            setIsLiveActive(true); setIsConnecting(false);
            const source = inCtx.createMediaStreamSource(stream);
            const processor = inCtx.createScriptProcessor(4096, 1, 1);
            processor.onaudioprocess = (e) => {
              const input = e.inputBuffer.getChannelData(0);
              const int16 = new Int16Array(input.length);
              for (let i = 0; i < input.length; i++) int16[i] = input[i] * 32768;
              sessionPromise.then(s => { if (sessionRef.current) s.sendRealtimeInput({ media: { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' } }); });
            };
            source.connect(processor); processor.connect(inCtx.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
            if (msg.toolCall) {
              for (const fc of msg.toolCall.functionCalls) {
                let result: any = "Done";
                const state = stateRef.current;

                if (fc.name === 'setCustomerInfo') {
                   const { name, tableNumber, phoneNumber } = fc.args as any;
                   setCustomerName(name); 
                   setSelectedTable(tableNumber); 
                   if (phoneNumber) setCustomerPhone(phoneNumber);
                   setCheckInPulse(true); 
                   setTimeout(() => setCheckInPulse(false), 2000);
                   result = `Confirmed. Name: ${name}, Table: ${tableNumber}. How can I help you with the menu?`;
                } else if (fc.name === 'prepareItemForTray') {
                  const { itemName, variant, quantity } = fc.args as any;
                  const res = prepareItemByVoice(itemName, variant, quantity || 1);
                  result = res.success || res.error;
                } else if (fc.name === 'confirmItemAddition') {
                  if (state.pendingVoiceItem) {
                    const { item, variant, quantity } = state.pendingVoiceItem;
                    state.addToCart(item, variant, quantity);
                    setPendingVoiceItem(null);
                    result = `Great! Added to tray. Anything else?`;
                  } else {
                    result = "I'm not sure which item you want to add. Could you repeat the name?";
                  }
                } else if (fc.name === 'checkTrayStatus') {
                  if (state.cart.length === 0) result = "Your tray is currently empty.";
                  else result = `You have: ${state.cart.map(i => `${i.quantity}x ${i.name}`).join(', ')}. Total is ₹${state.cart.reduce((a,c)=>a+(c.finalPrice*c.quantity),0)}.`;
                } else if (fc.name === 'placeFinalOrder') {
                  if (state.cart.length > 0 && state.customerName && state.selectedTable) {
                    const orderId = state.finalizeOrder();
                    result = orderId ? `Order placed! Your reference is ${orderId}.` : "Something went wrong placing the order.";
                  } else {
                    result = "I need your name and table number, and at least one item in the tray before I can place the order.";
                  }
                } else if (fc.name === 'cancelItemAddition') {
                  setPendingVoiceItem(null);
                  result = "Cancelled. What else would you like?";
                }

                sessionPromise.then(s => s.sendToolResponse({ functionResponses: { id: fc.id, name: fc.name, response: { result } } }));
              }
            }
            if (msg.serverContent?.modelTurn?.parts) {
              for (const p of msg.serverContent.modelTurn.parts) {
                if (p.inlineData?.data) {
                  setIsSpeaking(true);
                  const buf = await decodeAudioData(decode(p.inlineData.data), outCtx, 24000, 1);
                  const src = outCtx.createBufferSource(); src.buffer = buf; src.connect(outCtx.destination);
                  src.onended = () => { audioSourcesRef.current.delete(src); if (audioSourcesRef.current.size === 0) setIsSpeaking(false); };
                  src.start(Math.max(nextStartTimeRef.current, outCtx.currentTime)); nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outCtx.currentTime) + buf.duration;
                  audioSourcesRef.current.add(src);
                }
              }
            }
          },
          onerror: cleanupLiveSession, onclose: cleanupLiveSession,
        },
        config: { 
          responseModalities: [Modality.AUDIO], tools: [{ functionDeclarations: tools }],
          systemInstruction: `You are the 'Big Bellyz AI Assistant'. 
          Your goal is to guide the user through their ordering process with a warm, engaging, and conversational tone.
          
          PHASE 1: Welcome the user warmly. If they haven't provided their Name and Table Number, ask for them politely. If they mention a phone number, save it too. Use 'setCustomerInfo'.
          
          PHASE 2: Help them explore the menu. Use the MENU SUMMARY provided: ${menuSummary}. 
          When recommending a dish, don't just say the name—provide a brief, mouth-watering description based on the menu details. For example, if they ask for a burger, you might say: "Our Big Belly Burger is a real treat—it comes with double veg patties, two layers of melted cheese, and fresh veggies. Would you like me to add one to your tray?"
          
          PHASE 3: When a user wants to add food:
          1. Use 'prepareItemForTray'.
          2. Provide a brief, engaging highlight of the dish.
          3. Explicitly ask for confirmation (e.g., "That's a great choice! Shall I add that to your tray?").
          4. If confirmed, use 'confirmItemAddition'.
          
          PHASE 4: They can check their tray using 'checkTrayStatus' or finalize the order using 'placeFinalOrder'.
          
          Be cheerful, descriptive, and helpful. Use tools whenever appropriate. Always try to make the food sound delicious!`
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (e) { cleanupLiveSession(); }
  };

  const navigateToSuggestion = useCallback((s: SearchSuggestion) => {
    setSearchQuery('');
    setShowSuggestions(false);
    scrollToCategory(s.id);
    if (s.type === 'item' && s.itemName) {
      setTimeout(() => {
        setAnimatingItemId(`${s.itemName}-default`);
        setTimeout(() => setAnimatingItemId(null), 3000);
      }, 50);
    }
  }, [scrollToCategory]);

  const triggerPrint = useCallback(() => {
    if (!billOrder) return;
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) { alert("Pop-up blocked."); return; }
    const receiptHtml = `<html><head><title>Receipt_#${billOrder.orderId}</title><style>@page { margin: 0; size: 80mm auto; } body { margin: 0; padding: 5mm; font-family: 'Courier New', monospace; width: 72mm; color: #000; font-size: 10pt; line-height: 1.3; } .center { text-align: center; } .total-row { display: flex; justify-content: space-between; font-size: 12pt; font-weight: bold; margin-top: 2mm; border-top: 1px double #000; padding-top: 2mm; }</style></head><body><div class="center"><h1>THE BIG BELLYZ</h1><p>Premium Vegetarian</p></div><hr/><div>ORDER: #${billOrder.orderId}<br/>GUEST: ${billOrder.customerName}<br/>PHONE: ${billOrder.customerPhone || 'N/A'}<br/>TABLE: ${billOrder.table}</div><hr/><table style="width:100%">${billOrder.itemList.map(i => `<tr><td>${i.quantity}</td><td>${i.name}</td><td style="text-align:right">₹${(i.finalPrice * i.quantity).toFixed(0)}</td></tr>`).join('')}</table><div class="total-row"><span>TOTAL</span><span>₹${billOrder.total.toFixed(0)}</span></div><div class="center" style="margin-top:8mm"><p>Thank you!</p></div><script>window.onload=function(){window.print();}</script></body></html>`;
    printWindow.document.open(); printWindow.document.write(receiptHtml); printWindow.document.close();
  }, [billOrder]);

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <header className="bg-stone-900 text-white sticky top-0 z-[60] shadow-xl h-20">
        <div className="max-w-[1920px] mx-auto px-4 md:px-6 h-full flex items-center justify-between">
          <div className="flex flex-col">
            <h1 className="text-xl md:text-2xl lg:text-3xl font-serif font-bold tracking-tight flex items-center gap-2">
              The Big Bellyz
              <i className="fas fa-leaf text-emerald-500 text-sm md:text-base lg:text-lg"></i>
            </h1>
            <span className="text-[8px] md:text-[9px] uppercase tracking-[0.4em] text-tan font-bold">Premium Vegetarian</span>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            {!isAdminView && (
              <button 
                onClick={toggleLiveAPI} 
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all ${
                  isLiveActive ? 'border-tan bg-tan text-white' : 'border-white/10 bg-white/5 text-stone-500'
                } ${isConnecting ? 'animate-pulse' : ''}`}
              >
                <i className={`fas fa-microphone-lines text-sm ${isSpeaking ? 'animate-bounce' : ''}`}></i>
                <span className="text-[10px] font-black uppercase tracking-widest hidden md:block">
                  {isConnecting ? 'Connecting...' : isLiveActive ? 'Assistant Active' : 'Order by Voice'}
                </span>
              </button>
            )}
            {!isAdminView && (
              <button 
                onClick={() => setShowTrayModal(true)} 
                className={`relative px-4 py-2.5 rounded-xl bg-stone-800 text-white flex items-center gap-2 shadow-lg transition-all hover:bg-stone-700 ${isCartAnimating ? 'scale-110' : ''}`}
              >
                <i className="fas fa-shopping-basket text-sm text-tan"></i>
                <span className="text-[10px] font-black uppercase tracking-widest hidden sm:block">My Tray</span>
                {cart.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-tan text-white text-[10px] font-black rounded-full flex items-center justify-center animate-in zoom-in">
                    {cart.reduce((acc, i) => acc + i.quantity, 0)}
                  </span>
                )}
              </button>
            )}
            <button 
              onClick={() => { setIsAdminView(!isAdminView); setAdminTab('kitchen'); }} 
              className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md ${isAdminView ? 'bg-red-500 text-white' : 'bg-tan text-white'}`}
            >
              {isAdminView ? 'Exit Manager' : 'Manager Mode'}
            </button>
            {!isAdminView && (
              <button onClick={() => setShowTablePicker(true)} className={`px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-lg transition-all ${checkInPulse ? 'bg-emerald-500 text-white animate-pulse' : 'bg-tan text-white'}`}>
                <i className="fas fa-user-check text-xs"></i>
                <div className="text-left leading-none hidden sm:block">
                  <span className="text-[9px] block opacity-80 uppercase font-bold">{selectedTable ? `Table ${selectedTable}` : 'Check-In'}</span>
                  <span className="text-[10px] font-bold">{customerName || 'Guest'}</span>
                </div>
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-[1920px] mx-auto px-4 md:px-6 py-6 md:py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
          
          <main className="lg:col-span-12">
            {isAdminView ? (
              <div className="space-y-8 animate-in fade-in duration-500">
                <div className="flex items-center justify-between border-b border-stone-200 pb-6 mb-8 overflow-x-auto">
                   <div className="flex gap-4 md:gap-8 pb-2 scrollbar-hide">
                    <button onClick={() => setAdminTab('kitchen')} className={`text-xl font-serif font-bold transition-all whitespace-nowrap ${adminTab === 'kitchen' ? 'text-stone-900 underline decoration-tan decoration-4 underline-offset-8' : 'text-stone-300'}`}>Kitchen Monitor</button>
                    <button onClick={() => setAdminTab('dashboard')} className={`text-xl font-serif font-bold transition-all whitespace-nowrap ${adminTab === 'dashboard' ? 'text-stone-900 underline decoration-tan decoration-4 underline-offset-8' : 'text-stone-300'}`}>Dashboard</button>
                    <button onClick={() => setAdminTab('editor')} className={`text-xl font-serif font-bold transition-all whitespace-nowrap ${adminTab === 'editor' ? 'text-stone-900 underline decoration-tan decoration-4 underline-offset-8' : 'text-stone-300'}`}>Menu Editor</button>
                    <button onClick={() => setAdminTab('history')} className={`text-xl font-serif font-bold transition-all whitespace-nowrap ${adminTab === 'history' ? 'text-stone-900 underline decoration-tan decoration-4 underline-offset-8' : 'text-stone-300'}`}>Order Log</button>
                    <button onClick={() => setAdminTab('feedback')} className={`text-xl font-serif font-bold transition-all whitespace-nowrap ${adminTab === 'feedback' ? 'text-stone-900 underline decoration-tan decoration-4 underline-offset-8' : 'text-stone-300'}`}>Feedback Log</button>
                  </div>
                </div>

                {adminTab === 'kitchen' && (
                  <div className="space-y-12">
                    <h2 className="text-2xl font-serif font-bold text-stone-900">Active Order Stream</h2>
                    {groupedOrders.length === 0 ? (
                      <div className="bg-white rounded-[3rem] p-32 text-center border-2 border-dashed border-stone-100">
                        <i className="fas fa-hat-chef text-6xl text-stone-100 mb-6"></i>
                        <p className="text-stone-300 font-bold uppercase tracking-widest text-sm">No active orders</p>
                      </div>
                    ) : (
                      <div className="space-y-16">
                        {groupedOrders.map(group => (
                          <div key={group.table} className="space-y-6">
                            <div className="flex items-center gap-6 px-4">
                              <div className="bg-stone-900 text-white px-8 py-3 rounded-[1.5rem] text-xl font-serif font-bold">Table {group.table}</div>
                              <div className="h-px flex-1 bg-stone-200"></div>
                              <div className="text-[10px] font-black uppercase text-tan">{group.customerName}</div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                              {group.orders.map(order => (
                                <div key={order.orderId} className={`bg-white rounded-[2.5rem] p-8 shadow-xl border-t-[12px] relative transition-all ${order.status === 'Preparing' ? 'border-amber-400' : 'border-emerald-400'}`}>
                                  <div className="flex justify-between items-start mb-6">
                                    <h4 className="text-[11px] font-black text-stone-900 block uppercase tracking-widest">#{order.orderId.split('-').pop()}</h4>
                                    <span className="text-[10px] font-bold text-stone-300">{order.timestamp}</span>
                                  </div>
                                  <div className="space-y-4 mb-8 min-h-[120px]">
                                    {order.itemList.map((item, idx) => (
                                      <div key={idx} className="flex items-start gap-4">
                                        <div className="w-8 h-8 rounded-lg bg-stone-50 flex items-center justify-center text-[12px] font-black text-stone-900 shrink-0 border border-stone-100">{item.quantity}</div>
                                        <div className="flex-1">
                                          <p className="text-sm font-bold text-stone-800 leading-tight">{item.name}</p>
                                          {item.selectedVariant && <p className="text-[9px] font-black text-tan uppercase mt-0.5">{item.selectedVariant}</p>}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="pt-6 border-t border-stone-50 space-y-3">
                                    {order.status === 'Preparing' && <button onClick={() => updateStatus(order.orderId, 'Ready')} className="w-full py-4 bg-amber-500 text-white rounded-2xl text-[11px] font-black uppercase transition-all">Mark Ready</button>}
                                    {order.status === 'Ready' && <button onClick={() => updateStatus(order.orderId, 'Served')} className="w-full py-4 bg-emerald-500 text-white rounded-2xl text-[11px] font-black uppercase transition-all">Mark Served</button>}
                                    {order.status === 'Served' && <button onClick={() => updateStatus(order.orderId, 'Paid')} className="w-full py-4 bg-stone-900 text-white rounded-2xl text-[11px] font-black uppercase transition-all">Settle Order</button>}
                                    <button onClick={() => setBillOrder(order)} className="w-full py-3 bg-stone-50 text-stone-400 hover:text-stone-900 rounded-xl text-[9px] font-black uppercase transition-all"><i className="fas fa-file-invoice mr-2"></i> Bill View</button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {adminTab === 'dashboard' && (
                  <div className="space-y-12">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                       <div className="bg-white p-8 rounded-[2.5rem] border border-stone-100 shadow-xl">
                          <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">Total Sales</p>
                          <p className="text-4xl font-serif font-bold text-stone-900">₹{analytics.totalRevenue.toFixed(0)}</p>
                          <p className="text-[10px] font-bold text-emerald-500 mt-2">from {analytics.paidCount} orders</p>
                       </div>
                       <div className="bg-white p-8 rounded-[2.5rem] border border-stone-100 shadow-xl">
                          <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">Customer Rating</p>
                          <p className="text-4xl font-serif font-bold text-stone-900">{analytics.avgRating.toFixed(1)}/5</p>
                          <div className="flex items-center gap-1 mt-2 text-tan text-[8px]"><i className="fas fa-star"></i><i className="fas fa-star"></i><i className="fas fa-star"></i><i className="fas fa-star"></i><i className="fas fa-star-half"></i></div>
                       </div>
                    </div>
                    <div className="bg-stone-900 p-10 rounded-[3rem] shadow-xl text-white">
                       <div className="flex items-center justify-between mb-8">
                          <div><h3 className="text-xl font-serif font-bold text-tan">Feedback Analysis</h3><p className="text-[9px] font-black uppercase text-white/30 tracking-[0.3em]">AI-Powered Improvement Insights</p></div>
                          <button onClick={generateFeedbackInsights} disabled={isLoadingInsight} className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-[9px] font-black uppercase border border-white/10">
                            {isLoadingInsight ? 'Analyzing...' : 'Generate Report'}
                          </button>
                       </div>
                       <div className="bg-white/5 rounded-[2rem] p-8 border border-white/10 min-h-[300px]">
                          {aiInsight ? <div className="whitespace-pre-wrap font-medium leading-relaxed text-white/80 text-[13px]">{aiInsight}</div> : <div className="h-full flex flex-col items-center justify-center opacity-30 text-center"><i className="fas fa-brain text-4xl mb-4"></i><p className="text-[11px] font-black uppercase">Run report for AI analysis</p></div>}
                       </div>
                    </div>
                  </div>
                )}

                {adminTab === 'editor' && (
                  <div className="space-y-12">
                    <div className="flex justify-between items-center">
                      <h2 className="text-2xl font-serif font-bold text-stone-900">Menu Management</h2>
                    </div>
                    <div className="space-y-16">
                      {menu.map(cat => (
                        <div key={cat.id} className="bg-white rounded-[3rem] shadow-xl overflow-hidden border border-stone-100">
                          <div className="p-8 bg-stone-50 border-b border-stone-100 flex justify-between items-center">
                            <div className="flex items-center gap-4">
                              <img src={cat.imageUrl} className="w-12 h-12 rounded-xl object-cover" alt="" referrerPolicy="no-referrer" />
                              <h3 className="text-lg font-serif font-bold text-stone-900">{cat.title}</h3>
                            </div>
                            <button 
                              onClick={() => handleEditItem(cat.id, null)}
                              className="px-6 py-3 bg-stone-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-tan transition-all"
                            >
                              Add Item
                            </button>
                          </div>
                          <div className="p-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                              {cat.items.map((item, idx) => (
                                <div key={idx} className="p-6 rounded-2xl border border-stone-50 bg-stone-50/30 flex flex-col justify-between group hover:border-tan transition-all">
                                  <div>
                                    <div className="flex justify-between items-start mb-2">
                                      <h4 className="font-bold text-stone-800">{item.name}</h4>
                                      <span className="text-xs font-black text-stone-900">₹{item.price || item.priceVariant?.[0].price}</span>
                                    </div>
                                    <p className="text-[10px] text-stone-400 italic line-clamp-2">{item.description || 'No description'}</p>
                                  </div>
                                  <div className="mt-6 flex gap-2">
                                    <button 
                                      onClick={() => handleEditItem(cat.id, idx)}
                                      className="flex-1 py-2 bg-white border border-stone-100 rounded-lg text-[9px] font-black uppercase text-stone-400 hover:text-tan hover:border-tan transition-all"
                                    >
                                      Edit
                                    </button>
                                    <button 
                                      onClick={() => deleteMenuItem(cat.id, idx)}
                                      className="py-2 px-4 bg-white border border-stone-100 rounded-lg text-[9px] font-black uppercase text-red-300 hover:text-red-500 hover:border-red-500 transition-all"
                                    >
                                      <i className="fas fa-trash"></i>
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {adminTab === 'history' && (
                  <div className="bg-white rounded-[3rem] shadow-xl overflow-hidden border border-stone-100">
                    <div className="p-8 bg-stone-50 border-b border-stone-100 space-y-6">
                      <div className="flex justify-between items-center gap-4">
                        <input type="text" value={historySearchQuery} onChange={e => setHistorySearchQuery(e.target.value)} placeholder="Search log..." className="px-6 py-4 bg-white border border-stone-100 rounded-2xl text-xs outline-none focus:border-tan w-80" />
                        <div className="flex gap-3">
                          <button 
                            onClick={handleSaveToGoogleSheets} 
                            disabled={isSavingToSheets} 
                            className={`px-6 py-4 rounded-2xl text-[11px] font-black uppercase flex items-center gap-2 transition-all shadow-sm ${
                              saveStatus === 'success' ? 'bg-emerald-500 text-white' : 
                              saveStatus === 'error' ? 'bg-red-500 text-white' : 
                              'bg-stone-900 text-white hover:bg-tan disabled:opacity-50'
                            }`}
                          >
                            {isSavingToSheets ? <i className="fas fa-spinner animate-spin"></i> : saveStatus === 'success' ? <i className="fas fa-check"></i> : saveStatus === 'error' ? <i className="fas fa-exclamation-triangle"></i> : <i className="fas fa-cloud-upload-alt"></i>}
                            {isSavingToSheets ? 'Saving...' : saveStatus === 'success' ? 'Data Saved' : saveStatus === 'error' ? 'Failed' : 'Save to Sheets'}
                          </button>
                          <button onClick={handleExportToExcel} className="px-6 py-4 bg-emerald-50 text-emerald-600 rounded-2xl text-[11px] font-black uppercase hover:bg-emerald-100 transition-all">Export Excel</button>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-stone-100 shadow-inner">
                        <div className="w-8 h-8 rounded-lg bg-stone-50 flex items-center justify-center text-stone-300 shrink-0">
                          <i className="fas fa-link text-xs"></i>
                        </div>
                        <div className="flex-1">
                          <p className="text-[9px] font-black uppercase text-stone-400 tracking-widest mb-1">Google Apps Script Web App URL</p>
                          <input 
                            type="text" 
                            value={googleScriptUrl} 
                            onChange={e => setGoogleScriptUrl(e.target.value)} 
                            placeholder="https://script.google.com/macros/s/.../exec" 
                            className="w-full bg-transparent text-[11px] font-bold text-stone-600 outline-none placeholder:text-stone-200"
                          />
                        </div>
                      </div>
                    </div>
                    <table className="w-full text-left text-xs">
                      <thead className="bg-stone-50/50 uppercase font-black text-stone-400">
                        <tr>
                          <th className="px-8 py-6">Order</th>
                          <th className="px-8 py-6">Guest</th>
                          <th className="px-8 py-6">Table</th>
                          <th className="px-8 py-6">Status</th>
                          <th className="px-8 py-6 text-right">Revenue</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-50">
                        {orderHistory
                          .filter(o => 
                            o.orderId.toLowerCase().includes(historySearchQuery.toLowerCase()) || 
                            o.customerName.toLowerCase().includes(historySearchQuery.toLowerCase()) ||
                            o.status.toLowerCase().includes(historySearchQuery.toLowerCase())
                          )
                          .map(o => (
                          <tr key={o.orderId} className="hover:bg-stone-50">
                            <td className="px-8 py-6 font-bold">#{o.orderId}</td>
                            <td className="px-8 py-6 font-bold">{o.customerName}</td>
                            <td className="px-8 py-6">T-{o.table}</td>
                            <td className="px-8 py-6">
                              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                                o.status === 'Preparing' ? 'bg-amber-100 text-amber-600' : 
                                o.status === 'Ready' ? 'bg-blue-100 text-blue-600' :
                                o.status === 'Served' ? 'bg-indigo-100 text-indigo-600' :
                                'bg-emerald-100 text-emerald-600'
                              }`}>
                                {o.status}
                              </span>
                            </td>
                            <td className="px-8 py-6 text-right font-black">₹{o.total}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                
                {adminTab === 'feedback' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {feedbackHistory.map(fb => (
                      <div key={fb.id} className="bg-white p-8 rounded-[2.5rem] border border-stone-100 shadow-xl">
                        <div className="flex justify-between items-center mb-6">
                          <span className="text-[10px] font-black bg-stone-900 text-white px-3 py-1 rounded-full">{fb.rating}/5</span>
                          <span className="text-[9px] text-stone-300 uppercase font-bold">{fb.timestamp}</span>
                        </div>
                        <p className="font-bold text-stone-800 mb-4">{fb.customerName}</p>
                        <p className="text-sm text-stone-500 italic leading-relaxed">"{fb.comment}"</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-12 animate-in fade-in duration-500">
                {/* --- Search Component --- */}
                <div className="relative mb-6">
                  <div className="flex items-center bg-white border border-stone-200 rounded-[2.5rem] shadow-sm overflow-hidden focus-within:ring-2 focus-within:ring-tan transition-all">
                    <i className="fas fa-search ml-6 text-stone-300"></i>
                    <input 
                      type="text" 
                      value={searchQuery} 
                      onChange={e => { setSearchQuery(e.target.value); setShowSuggestions(true); }} 
                      onFocus={() => setShowSuggestions(true)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && searchSuggestions.length > 0) {
                          navigateToSuggestion(searchSuggestions[0]);
                        }
                      }}
                      placeholder="Search items or categories... (Hit Enter to jump to result)" 
                      className="w-full pl-4 pr-6 py-5 outline-none text-sm font-medium" 
                    />
                    {searchQuery && (
                      <button onClick={() => { setSearchQuery(''); setShowSuggestions(false); }} className="px-4 text-stone-300 hover:text-stone-900 transition-colors">
                        <i className="fas fa-times"></i>
                      </button>
                    )}
                  </div>
                  
                  {/* --- Search Suggestions --- */}
                  {showSuggestions && searchSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-[2rem] shadow-2xl border border-stone-100 overflow-hidden z-[70] animate-in fade-in slide-in-from-top-2">
                       {searchSuggestions.map((s, idx) => (
                         <button 
                           key={idx} 
                           onClick={() => navigateToSuggestion(s)}
                           className="w-full text-left px-8 py-5 border-b border-stone-50 last:border-0 hover:bg-stone-50 flex items-center justify-between transition-all group"
                         >
                           <div>
                             <p className="font-bold text-stone-800 text-sm group-hover:text-tan transition-colors">{s.label}</p>
                             <p className="text-[10px] text-stone-400 uppercase font-black tracking-widest">
                               {s.type === 'category' ? 'Menu Tab' : `In ${menu.find(c => c.id === s.id)?.title}`}
                             </p>
                           </div>
                           <i className={`fas ${s.type === 'category' ? 'fa-arrow-right-from-bracket' : 'fa-arrow-right'} text-[10px] text-stone-200 group-hover:translate-x-2 transition-transform`}></i>
                         </button>
                       ))}
                    </div>
                  )}
                  {showSuggestions && searchQuery.length >= 2 && searchSuggestions.length === 0 && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-[2rem] p-8 text-center shadow-xl border border-stone-100 z-[70]">
                       <p className="text-stone-400 text-sm italic font-medium">No matches found for "{searchQuery}"</p>
                    </div>
                  )}
                </div>

                <nav className="bg-white/95 backdrop-blur-md sticky top-20 z-50 py-5 border-b border-stone-100 flex gap-3 overflow-x-auto custom-scrollbar -mx-4 px-4 items-center">
                  {menu.map(cat => (
                    <button key={cat.id} onClick={() => scrollToCategory(cat.id)} className={`px-6 py-3 rounded-full text-[11px] font-black uppercase transition-all whitespace-nowrap ${activeCategory === cat.id ? 'bg-stone-900 text-white shadow-lg' : 'bg-white border text-stone-400 hover:bg-stone-50'}`}>{cat.title}</button>
                  ))}
                  <div className="h-6 w-px bg-stone-200 mx-2 shrink-0"></div>
                  <button 
                    onClick={() => { setShowFeedbackModal(true); setFeedbackRating(0); }} 
                    className="px-6 py-3 rounded-full text-[11px] font-black uppercase transition-all whitespace-nowrap bg-tan text-white shadow-lg hover:bg-stone-900 flex items-center gap-2 shrink-0"
                  >
                    <i className="fas fa-star text-[10px]"></i>
                    Rate Experience
                  </button>
                </nav>

                {(searchQuery.trim() ? filteredMenu : menu).map(cat => (
                  <section key={cat.id} id={cat.id} className="scroll-mt-40">
                    <div className="relative h-56 md:h-72 rounded-[3rem] overflow-hidden mb-10 shadow-2xl group">
                      <img 
                        src={cat.imageUrl} 
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" 
                        alt={cat.title} 
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-stone-900/90 via-transparent flex flex-col justify-end p-10 md:p-12">
                        <h2 className="text-4xl md:text-5xl font-serif font-bold text-white tracking-tight">{cat.title}</h2>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                      {cat.items.map((item, idx) => (
                        <MenuItemCard 
                          key={idx} 
                          item={item} 
                          animatingItemId={animatingItemId} 
                          addToCart={addToCart} 
                        />
                      ))}
                    </div>
                  </section>
                ))}
                
                {searchQuery.trim() && filteredMenu.length === 0 && (
                  <div className="py-48 text-center bg-white rounded-[3rem] border border-dashed border-stone-200">
                     <i className="fas fa-search-minus text-4xl text-stone-200 mb-6"></i>
                     <p className="text-stone-400 font-bold uppercase tracking-widest text-sm">No items found for "{searchQuery}"</p>
                     <button onClick={() => setSearchQuery('')} className="mt-6 text-tan font-black uppercase text-[10px] underline decoration-2 underline-offset-4">Reset Search</button>
                  </div>
                )}
              </div>
            )}
          </main>

          {!isAdminView && isLiveActive && (
            <div className="fixed bottom-8 left-8 z-[100] max-w-xs animate-in slide-in-from-left-10 fade-in duration-500">
              <div className="bg-tan/10 border-2 border-tan rounded-[2.5rem] p-6 backdrop-blur-md shadow-2xl">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-tan rounded-full flex items-center justify-center text-white shrink-0">
                    <i className={`fas fa-wave-square ${isSpeaking ? 'animate-pulse' : ''}`}></i>
                  </div>
                  <div>
                    <h4 className="text-[11px] font-black text-tan uppercase tracking-widest leading-none mb-1">Voice Assistant</h4>
                    <p className="text-[10px] text-stone-600 font-bold">Listening for your order...</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* --- Overlay Modals --- */}
      {showTrayModal && !isAdminView && (
        <div className="fixed inset-0 z-[150] flex items-center justify-end p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-stone-900 rounded-[3.5rem] shadow-2xl overflow-hidden flex flex-col w-full max-w-md h-[90vh] animate-in slide-in-from-right-10 duration-500 border border-white/10">
            <div className="p-10 border-b border-white/5 bg-white/5 shrink-0 relative">
              <button onClick={() => setShowTrayModal(false)} className="absolute top-8 right-8 text-white/30 hover:text-white p-2 transition-colors"><i className="fas fa-times text-xl"></i></button>
              <div className="flex justify-between items-center mb-8 pr-12">
                <h3 className="text-[11px] font-black text-tan uppercase tracking-[0.4em]">Your Tray</h3>
                <button onClick={() => setCart([])} disabled={cart.length === 0} className="text-[10px] font-bold text-red-400 uppercase tracking-widest disabled:opacity-30">Clear All</button>
              </div>
              <div className="bg-white/5 p-6 rounded-[2rem] border border-white/10 flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-stone-500 uppercase tracking-widest">Guest</span>
                  <span className="text-xs font-bold text-white truncate max-w-[120px]">{customerName || 'Anonymous'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-stone-500 uppercase tracking-widest">Table</span>
                  <span className="text-xs font-black text-tan">{selectedTable ? `Table ${selectedTable}` : '--'}</span>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-3">
              {cart.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center bg-white/5 p-5 rounded-[2rem] border border-white/5 group hover:bg-white/10 transition-all">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <span className="w-10 h-10 rounded-2xl bg-tan/10 text-tan flex items-center justify-center text-sm font-black shrink-0 border border-tan/20">{item.quantity}</span>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-white text-[15px] truncate group-hover:text-tan transition-colors">{item.name}</h4>
                      {item.selectedVariant && <p className="text-[9px] font-black text-tan uppercase tracking-widest mt-0.5">{item.selectedVariant}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-6 ml-4 shrink-0">
                    <div className="text-right">
                      <p className="font-black text-white text-base leading-none">₹{(item.finalPrice * item.quantity).toFixed(0)}</p>
                      <p className="text-[9px] text-white/20 font-bold mt-1">₹{item.finalPrice} ea</p>
                    </div>
                    <button onClick={() => setCart(prev => prev.filter((_, i) => i !== idx))} className="text-white/10 hover:text-red-400 transition-colors p-2">
                      <i className="fas fa-trash-alt text-[10px]"></i>
                    </button>
                  </div>
                </div>
              ))}
              {cart.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center opacity-10 text-white py-24">
                  <i className="fas fa-shopping-basket text-6xl mb-6"></i>
                  <p className="text-[11px] font-black uppercase tracking-widest">Tray is Empty</p>
                </div>
              )}
            </div>
            <div className="p-10 bg-stone-950/50 shrink-0">
              <div className="flex justify-between items-end mb-6">
                <span className="text-[11px] text-stone-500 font-bold uppercase tracking-widest">Total</span>
                <span className="text-4xl font-serif font-bold text-white">₹{cartTotal.toFixed(0)}</span>
              </div>
              
              {(!customerName || !selectedTable) && cart.length > 0 && (
                <p className="text-[10px] text-tan font-bold uppercase tracking-widest text-center mb-6 animate-pulse">
                  <i className="fas fa-info-circle mr-2"></i>
                  Please Check-In to Place Order
                </p>
              )}

              <button 
                onClick={() => { 
                  if (!customerName || !selectedTable) {
                    setShowTrayModal(false);
                    setShowTablePicker(true);
                  } else {
                    setShowTrayModal(false); 
                    setShowConfirmModal(true); 
                  }
                }} 
                disabled={cart.length === 0} 
                className="w-full py-7 bg-tan text-white rounded-[2.5rem] font-black uppercase text-[12px] tracking-[0.3em] hover:bg-white hover:text-tan transition-all active:scale-95 disabled:opacity-20 shadow-2xl"
              >
                {(!customerName || !selectedTable) ? 'Check-In to Order' : 'Finalize Order'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingItem && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-stone-900/90 backdrop-blur-md animate-in fade-in">
          <div className="bg-white rounded-[3.5rem] p-10 md:p-14 max-w-2xl w-full shadow-2xl relative overflow-hidden max-h-[90vh] overflow-y-auto custom-scrollbar">
            <button onClick={() => setEditingItem(null)} className="absolute top-10 right-10 text-stone-300 hover:text-stone-900 p-3"><i className="fas fa-times text-2xl"></i></button>
            <div className="text-center mb-12">
              <h3 className="text-4xl font-serif font-bold text-stone-900 mb-4">
                {editingItem.itemIndex === null ? 'Add New Item' : 'Edit Menu Item'}
              </h3>
              <p className="text-stone-400 text-[13px] font-medium uppercase tracking-widest">
                Category: {menu.find(c => c.id === editingItem.categoryId)?.title}
              </p>
            </div>
            
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-4">Item Name</label>
                  <input 
                    type="text" 
                    value={itemForm.name} 
                    onChange={e => setItemForm({ ...itemForm, name: e.target.value })}
                    placeholder="e.g. Cheese Burger" 
                    className="w-full px-8 py-5 bg-stone-50 border border-stone-100 rounded-[2rem] outline-none focus:border-tan transition-all font-bold text-sm" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-4">Base Price (e.g. 100/-)</label>
                  <input 
                    type="text" 
                    value={itemForm.price} 
                    onChange={e => setItemForm({ ...itemForm, price: e.target.value })}
                    placeholder="e.g. 100/-" 
                    className="w-full px-8 py-5 bg-stone-50 border border-stone-100 rounded-[2rem] outline-none focus:border-tan transition-all font-bold text-sm" 
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-4">Description</label>
                <textarea 
                  value={itemForm.description} 
                  onChange={e => setItemForm({ ...itemForm, description: e.target.value })}
                  placeholder="Describe the deliciousness..." 
                  className="w-full px-8 py-5 bg-stone-50 border border-stone-100 rounded-[2rem] outline-none focus:border-tan transition-all font-medium text-sm h-32 resize-none" 
                />
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-4">Price Variants (Optional)</label>
                  <button 
                    onClick={() => setItemForm({ ...itemForm, priceVariant: [...(itemForm.priceVariant || []), { label: '', price: '' }] })}
                    className="text-[9px] font-black uppercase text-tan hover:text-stone-900 transition-colors"
                  >
                    + Add Variant
                  </button>
                </div>
                <div className="space-y-3">
                  {itemForm.priceVariant?.map((v, idx) => (
                    <div key={idx} className="flex gap-3 items-center animate-in slide-in-from-left-2">
                      <input 
                        type="text" 
                        value={v.label} 
                        onChange={e => {
                          const newVariants = [...(itemForm.priceVariant || [])];
                          newVariants[idx].label = e.target.value;
                          setItemForm({ ...itemForm, priceVariant: newVariants });
                        }}
                        placeholder="Label (e.g. Small)" 
                        className="flex-1 px-6 py-3 bg-stone-50 border border-stone-100 rounded-xl outline-none focus:border-tan transition-all font-bold text-xs" 
                      />
                      <input 
                        type="text" 
                        value={v.price} 
                        onChange={e => {
                          const newVariants = [...(itemForm.priceVariant || [])];
                          newVariants[idx].price = e.target.value;
                          setItemForm({ ...itemForm, priceVariant: newVariants });
                        }}
                        placeholder="Price (e.g. 120/-)" 
                        className="w-32 px-6 py-3 bg-stone-50 border border-stone-100 rounded-xl outline-none focus:border-tan transition-all font-bold text-xs" 
                      />
                      <button 
                        onClick={() => {
                          const newVariants = [...(itemForm.priceVariant || [])];
                          newVariants.splice(idx, 1);
                          setItemForm({ ...itemForm, priceVariant: newVariants });
                        }}
                        className="text-red-300 hover:text-red-500 p-2"
                      >
                        <i className="fas fa-times"></i>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <button 
                onClick={saveMenuItem}
                className="w-full py-7 bg-stone-900 text-white rounded-[2.5rem] font-black uppercase text-[12px] tracking-[0.4em] shadow-2xl hover:bg-tan active:scale-95 transition-all"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {showFeedbackModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-stone-900/90 backdrop-blur-md animate-in fade-in">
          <div className="bg-white rounded-[3.5rem] p-10 md:p-14 max-w-lg w-full shadow-2xl relative overflow-hidden">
            {feedbackSuccess ? (
              <div className="py-20 text-center animate-in zoom-in"><div className="w-24 h-24 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center text-4xl mx-auto mb-8 shadow-inner animate-bounce"><i className="fas fa-check"></i></div><h3 className="text-3xl font-serif font-bold text-stone-900 mb-4">Thank You!</h3><p className="text-stone-400 text-sm font-medium">Your feedback helps improve Big Bellyz.</p></div>
            ) : (
              <>
                <button onClick={() => setShowFeedbackModal(false)} className="absolute top-10 right-10 text-stone-300 hover:text-stone-900 p-3"><i className="fas fa-times text-2xl"></i></button>
                <div className="text-center mb-12"><h3 className="text-4xl font-serif font-bold text-stone-900 mb-4">Guest Insight</h3><p className="text-stone-400 text-[13px] font-medium leading-relaxed">Share your experience to help us improve.</p></div>
                <form onSubmit={(e) => { e.preventDefault(); if (feedbackRating === 0) return alert("Select a rating."); const formData = new FormData(e.currentTarget); submitFeedback(feedbackRating, formData.get('comment') as string); }} className="space-y-12">
                  <div className="flex justify-center gap-3">{[1, 2, 3, 4, 5].map(num => <button key={num} type="button" onMouseEnter={() => setFeedbackHover(num)} onMouseLeave={() => setFeedbackHover(0)} onClick={() => setFeedbackRating(num)} className={`text-5xl transition-all duration-300 ${ (feedbackHover || feedbackRating) >= num ? 'text-tan scale-110' : 'text-stone-100' }`}><i className="fas fa-star"></i></button>)}</div>
                  <textarea name="comment" required placeholder="Tell us what you loved..." className="w-full px-8 py-6 bg-stone-50 border border-stone-100 rounded-[2rem] outline-none focus:border-tan transition-all font-medium text-sm h-40 resize-none shadow-inner" />
                  <button type="submit" disabled={isFeedbackSubmitting} className="w-full py-7 bg-stone-900 text-white rounded-[2.5rem] font-black uppercase text-[12px] tracking-[0.4em] shadow-2xl hover:bg-tan active:scale-95 transition-all disabled:opacity-50">{isFeedbackSubmitting ? 'Submitting...' : 'Send Insight'}</button>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {billOrder && (
        <div className="fixed inset-0 z-[200] flex items-start justify-center p-4 pt-12 bg-stone-900/98 backdrop-blur-xl overflow-y-auto no-print">
          <div className="bg-white rounded-[3rem] p-10 max-w-sm w-full shadow-2xl relative border-t-[16px] border-tan animate-in zoom-in-95">
            <button onClick={() => setBillOrder(null)} className="absolute top-8 right-8 text-stone-300 hover:text-stone-900 p-3"><i className="fas fa-times text-2xl"></i></button>
            <div className="text-center mb-10"><h1 className="text-3xl font-serif font-bold text-stone-900 mb-1">THE BIG BELLYZ</h1><p className="text-[11px] uppercase tracking-[0.4em] text-stone-400 font-black mb-8">Premium Vegetarian</p></div>
            <div className="space-y-4 mb-10">{billOrder.itemList.map((item, idx) => <div key={idx} className="flex justify-between text-[13px] font-bold text-stone-800"><span>{item.name} x{item.quantity}</span><span className="font-black text-stone-900">₹{(item.finalPrice * item.quantity).toFixed(0)}</span></div>)}</div>
            <div className="border-t-2 border-dashed border-stone-200 pt-8 space-y-3"><div className="flex justify-between text-3xl font-serif font-bold text-stone-900 pt-6"><span>Total</span><span>₹{billOrder.total.toFixed(0)}</span></div><p className="text-[9px] font-black uppercase text-stone-300 tracking-widest text-center mt-6">Inclusive of all taxes</p></div>
            <div className="mt-12 flex flex-col gap-3"><button onClick={triggerPrint} className="w-full py-6 bg-stone-900 text-white rounded-[2rem] font-black uppercase text-[12px] tracking-[0.2em] shadow-2xl transition-all hover:bg-tan"><i className="fas fa-file-pdf mr-3"></i> Confirm & Print</button></div>
          </div>
        </div>
      )}

      {showTablePicker && (
        <div className="fixed inset-0 z-[110] flex items-start justify-center p-4 pt-12 md:pt-24 bg-stone-900/95 backdrop-blur-md overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-[3rem] p-10 md:p-14 max-w-lg w-full shadow-2xl relative my-6">
            <button onClick={() => setShowTablePicker(false)} className="absolute top-10 right-10 text-stone-300 hover:text-stone-900 p-3"><i className="fas fa-times text-3xl"></i></button>
            <h3 className="text-4xl font-serif font-bold text-center mb-12 text-stone-900">Guest Check-In</h3>
            <div className="space-y-10">
              <input autoFocus type="text" value={tempCustomerName} onChange={e => setTempCustomerName(e.target.value)} placeholder="Full Name" className="w-full px-10 py-6 bg-stone-50 border-2 border-stone-100 rounded-[2rem] outline-none font-bold text-2xl focus:border-tan transition-all text-center" />
              <div>
                <p className="text-[11px] font-black text-stone-400 uppercase text-center mb-6 tracking-[0.3em]">Select Table</p>
                <div className="grid grid-cols-5 gap-4">{[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map(num => <button key={num} onClick={() => setTempTable(num)} className={`aspect-square rounded-2xl font-black text-lg border-2 transition-all ${tempTable === num ? 'bg-tan text-white border-tan scale-110 shadow-xl' : 'bg-stone-50 text-stone-300 border-stone-100 hover:border-tan/40'}`}>{num}</button>)}</div>
              </div>
            </div>
            <button onClick={() => { setCustomerName(tempCustomerName); setSelectedTable(tempTable); setShowTablePicker(false); }} disabled={!tempTable || !tempCustomerName.trim()} className="w-full py-6 bg-stone-900 text-white rounded-[2.5rem] font-black mt-14 uppercase text-[12px] tracking-[0.3em] shadow-2xl transition-all disabled:opacity-10">Open Menu</button>
          </div>
        </div>
      )}

      {showConfirmModal && (
        <div className="fixed inset-0 z-[120] flex items-start justify-center p-4 pt-12 md:pt-24 bg-stone-900/95 backdrop-blur-md overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-[3.5rem] p-10 md:p-14 max-w-lg w-full shadow-2xl relative my-6 overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-tan"></div>
            <h3 className="text-4xl font-serif font-bold mb-2 text-stone-900">Review Order</h3>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-stone-400 mb-10">Final check before the kitchen starts</p>
            
            <div className="bg-stone-50 rounded-3xl p-6 mb-10 flex flex-col gap-3 border border-stone-100">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Guest</span>
                <span className="text-sm font-bold text-stone-900">{customerName || 'Guest'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Table</span>
                <span className="text-sm font-black text-tan">Table {selectedTable}</span>
              </div>
            </div>

            <div className="space-y-5 mb-10 max-h-72 overflow-y-auto custom-scrollbar pr-3">
              {cart.map((item, i) => (
                <div key={i} className="flex justify-between items-start text-sm border-b border-stone-50 pb-5 last:border-0">
                  <div className="flex-1 pr-4">
                    <p className="font-bold text-stone-800 leading-tight">{item.name}</p>
                    {item.selectedVariant && <p className="text-[9px] font-black text-tan uppercase mt-0.5">{item.selectedVariant}</p>}
                    <p className="text-[10px] text-stone-400 font-bold mt-1">Qty: {item.quantity} × ₹{item.finalPrice}</p>
                  </div>
                  <span className="font-black text-stone-900 shrink-0">₹{(item.finalPrice * item.quantity).toFixed(0)}</span>
                </div>
              ))}
            </div>

            <div className="pt-8 border-t-2 border-dashed border-stone-100 mb-10">
              <div className="flex justify-between items-end">
                <span className="text-[11px] font-black text-stone-400 uppercase tracking-widest">Total Amount</span>
                <span className="text-4xl font-serif font-bold text-stone-900">₹{cartTotal.toFixed(0)}</span>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <button 
                onClick={finalizeOrder} 
                disabled={!customerName || !selectedTable} 
                className="w-full py-7 bg-stone-900 text-white rounded-[2.5rem] font-black uppercase text-[12px] tracking-[0.4em] shadow-2xl hover:bg-tan transition-all active:scale-95 disabled:opacity-20"
              >
                Confirm & Send to Kitchen
              </button>
              <button 
                onClick={() => setShowConfirmModal(false)} 
                className="w-full py-4 text-stone-400 font-black uppercase text-[11px] tracking-widest hover:text-stone-900 transition-colors"
              >
                Go Back to Menu
              </button>
            </div>
          </div>
        </div>
      )}

      {showSuccessModal && lastOrder && (
        <div className="fixed inset-0 z-[130] flex items-start justify-center p-4 pt-12 bg-stone-900/98 backdrop-blur-xl animate-in fade-in">
          <div className="bg-white rounded-[3rem] p-14 max-w-md w-full shadow-2xl text-center animate-in zoom-in-95">
            <div className="w-24 h-24 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center text-4xl mx-auto mb-8"><i className="fas fa-check"></i></div>
            <h3 className="text-4xl font-serif font-bold text-stone-900 leading-tight mb-3">Order Sent!</h3>
            <p className="text-[11px] text-stone-400 uppercase font-black tracking-[0.4em] mb-10">Reference: {lastOrder.orderId}</p>
            <div className="flex flex-col gap-4">
              <button onClick={() => setShowSuccessModal(false)} className="w-full py-6 bg-stone-900 text-white rounded-[2.5rem] font-black uppercase text-[12px] tracking-[0.3em] shadow-2xl active:scale-95 transition-all">Back to Menu</button>
              <button onClick={() => { setShowSuccessModal(false); setShowFeedbackModal(true); setFeedbackRating(0); }} className="w-full py-4 text-tan font-black uppercase text-[10px] tracking-widest hover:text-stone-900 transition-colors">Share Feedback</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
