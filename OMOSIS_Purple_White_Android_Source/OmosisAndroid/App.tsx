import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './src/lib/supabase';
import starterProducts from './src/lib/starterProducts.json';
import { CartLine, Order, Product } from './src/lib/types';
import { money, niceCategory } from './src/lib/format';

const purple = '#6442DE';
const ink = '#201B31';
const muted = '#777386';
const bg = '#F7F6FC';
const line = '#EAE7F2';
const AppCtx = createContext<any>(null);
const Tabs = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
const useApp = () => useContext(AppCtx);

function normalizeDbProduct(row: any): Product {
  return {
    id: String(row.id), name: row.name || 'Untitled product', seller: row.seller_profiles?.store_name || 'Omosis seller',
    price: Number(row.price || 0), mrp: Number(row.mrp || row.price || 0), category: row.category || 'other',
    description: row.description || 'A local find from the Omosis marketplace.', stock: Number(row.stock || 0),
    image: row.image_url || null, seller_id: row.seller_id, active: row.active,
  };
}
const fallbackProducts: Product[] = (starterProducts as any[]).map(p => ({ ...p, id: String(p.id), stock: Number(p.stock ?? 10), image: p.image || p.image_url || null }));

function AppProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<any>(null);
  const [products, setProducts] = useState<Product[]>(fallbackProducts);
  const [usingFallback, setUsingFallback] = useState(false);
  const [productsLoading, setProductsLoading] = useState(true);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartReady, setCartReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    AsyncStorage.getItem('omosis-mobile-cart').then(raw => {
      if (raw) {
        try {
          const saved = JSON.parse(raw) as Array<{ id: string; quantity: number; product?: Product }>;
          setCart(saved.map(item => ({ product: item.product || fallbackProducts.find(p => p.id === item.id) || ({ id: item.id } as Product), quantity: item.quantity })).filter(x => x.product.name));
        } catch { setCart([]); }
      }
      setCartReady(true);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!cartReady) return;
    AsyncStorage.setItem('omosis-mobile-cart', JSON.stringify(cart.map(x => ({ id: x.product.id, product: x.product, quantity: x.quantity })))).catch(() => {});
  }, [cart, cartReady]);

  const loadProducts = async () => {
    setProductsLoading(true);
    try {
      const { data, error } = await supabase.from('products').select('*,seller_profiles(store_name)').eq('active', true).order('created_at', { ascending: false });
      if (error) throw error;
      if (data && data.length) { setProducts(data.map(normalizeDbProduct)); setUsingFallback(false); }
      else { setProducts(fallbackProducts); setUsingFallback(true); }
    } catch (e) {
      setProducts(fallbackProducts); setUsingFallback(true);
    } finally { setProductsLoading(false); }
  };
  useEffect(() => { loadProducts(); }, []);

  const addToCart = (product: Product) => setCart(prev => {
    const existing = prev.find(x => x.product.id === product.id);
    if (existing) return prev.map(x => x.product.id === product.id ? { ...x, quantity: Math.min(99, x.quantity + 1) } : x);
    return [...prev, { product, quantity: 1 }];
  });
  const changeQuantity = (id: string, amount: number) => setCart(prev => prev.map(x => x.product.id === id ? { ...x, quantity: x.quantity + amount } : x).filter(x => x.quantity > 0));
  const clearCart = () => { setCart([]); AsyncStorage.removeItem('omosis-mobile-cart').catch(() => {}); };
  const cartCount = cart.reduce((n, x) => n + x.quantity, 0);
  const cartTotal = cart.reduce((n, x) => n + x.product.price * x.quantity, 0);
  const value = { session, user: session?.user || null, products, productsLoading, usingFallback, loadProducts, cart, addToCart, changeQuantity, clearCart, cartCount, cartTotal, signOut: () => supabase.auth.signOut() };
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

function Button({ title, onPress, secondary = false, disabled = false, style }: any) {
  return <Pressable onPress={onPress} disabled={disabled} style={[styles.button, secondary && styles.buttonSecondary, disabled && { opacity: .55 }, style]}><Text style={[styles.buttonText, secondary && styles.buttonSecondaryText]}>{title}</Text></Pressable>;
}
function Field({ label, value, onChangeText, placeholder, secureTextEntry, keyboardType, multiline, autoCapitalize }: any) {
  return <View style={styles.fieldWrap}><Text style={styles.fieldLabel}>{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder || label} placeholderTextColor="#A29CAF" secureTextEntry={secureTextEntry} keyboardType={keyboardType} multiline={multiline} autoCapitalize={autoCapitalize || 'sentences'} style={[styles.input, multiline && { height: 84, textAlignVertical: 'top' }]} /></View>;
}
function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  return <View style={styles.header}><View style={styles.brandRow}><View style={styles.logo}><Text style={styles.logoText}>O</Text></View><Text style={styles.brand}>Omosis</Text><View style={{ flex: 1 }} /><View style={styles.codPill}><Text style={styles.codText}>COD</Text></View></View><Text style={styles.pageTitle}>{title}</Text>{!!subtitle && <Text style={styles.pageSubtitle}>{subtitle}</Text>}</View>;
}
function ProductCard({ item, onPress }: { item: Product; onPress: () => void }) {
  return <Pressable style={styles.productCard} onPress={onPress}><View style={styles.productImageWrap}>{item.image ? <Image source={{ uri: item.image }} style={styles.productImage} resizeMode="cover" /> : <View style={styles.imageFallback}><Text style={styles.imageFallbackText}>{niceCategory(item.category).slice(0, 1)}</Text></View>}</View><Text numberOfLines={1} style={styles.productName}>{item.name}</Text><Text numberOfLines={1} style={styles.productSeller}>{item.seller || 'Omosis seller'}</Text><View style={styles.priceRow}><Text style={styles.price}>{money(item.price)}</Text>{item.mrp > item.price && <Text style={styles.mrp}>{money(item.mrp)}</Text>}</View><Text style={styles.productCategory}>{niceCategory(item.category)}</Text></Pressable>;
}
function HomeScreen({ navigation }: any) {
  const { products, productsLoading, usingFallback, loadProducts, addToCart } = useApp();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState('featured');
  const categories = useMemo(() => ['all', ...Array.from(new Set(products.map((p: Product) => p.category)))], [products]);
  const filtered = useMemo(() => {
    let rows = products.filter((p: Product) => `${p.name} ${p.category} ${p.seller} ${p.description}`.toLowerCase().includes(query.toLowerCase()) && (category === 'all' || p.category === category));
    if (sort === 'low') rows = [...rows].sort((a: Product, b: Product) => a.price - b.price);
    if (sort === 'high') rows = [...rows].sort((a: Product, b: Product) => b.price - a.price);
    return rows;
  }, [products, query, category, sort]);
  return <SafeAreaView style={styles.screen}><ScrollView refreshControl={<RefreshControl refreshing={productsLoading} onRefresh={loadProducts} tintColor={purple} />} keyboardShouldPersistTaps="handled"><Header title="Find your local favourite." subtitle="Discover good things from local sellers across India." />
    {usingFallback && <View style={styles.notice}><Text style={styles.noticeText}>Showing the bundled starter catalog because live products could not be loaded. Pull down to retry. Checkout may require a real database product.</Text></View>}
    <View style={styles.searchWrap}><Text style={styles.searchIcon}>⌕</Text><TextInput value={query} onChangeText={setQuery} placeholder="Search products, categories..." placeholderTextColor="#9690A3" style={styles.searchInput} returnKeyType="search" /></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>{categories.map((c: string) => <Pressable key={c} onPress={() => setCategory(c)} style={[styles.chip, category === c && styles.chipActive]}><Text style={[styles.chipText, category === c && styles.chipTextActive]}>{c === 'all' ? 'All finds' : niceCategory(c)}</Text></Pressable>)}</ScrollView>
    <View style={styles.sectionTitleRow}><View><Text style={styles.sectionTitle}>{query ? 'Search results' : 'Made for discovering'}</Text><Text style={styles.sectionSubtitle}>{filtered.length} products to explore</Text></View><View style={styles.sortRow}>{[['featured','Featured'],['low','Price ↑'],['high','Price ↓']].map(([key,label]) => <Pressable key={key} onPress={() => setSort(key)} style={[styles.sortChip, sort === key && styles.sortChipActive]}><Text style={[styles.sortText, sort === key && { color: purple }]}>{label}</Text></Pressable>)}</View></View>
    {productsLoading && <ActivityIndicator color={purple} style={{ margin: 16 }} />}
    {filtered.length ? <View style={styles.productGrid}>{filtered.map((p: Product) => <ProductCard key={p.id} item={p} onPress={() => navigation.navigate('Product', { productId: p.id })} />)}</View> : <Empty title="No products found" body="Try a different search or category." />}
    <View style={styles.promiseCard}><Text style={styles.promiseTitle}>Shop local. Keep it simple.</Text><Text style={styles.promiseBody}>Clear product details, a simple bag, and Cash on Delivery at checkout.</Text></View>
  </ScrollView></SafeAreaView>;
}
function ProductScreen({ route, navigation }: any) {
  const { products, addToCart } = useApp();
  const product: Product | undefined = products.find((p: Product) => p.id === String(route.params.productId));
  if (!product) return <SafeAreaView style={styles.screen}><Empty title="Product unavailable" body="It may have been removed or is not available right now." /><Button title="Back to shopping" onPress={() => navigation.goBack()} /></SafeAreaView>;
  return <SafeAreaView style={styles.screen}><ScrollView><Pressable onPress={() => navigation.goBack()} style={styles.backLink}><Text style={styles.backLinkText}>‹  Back to shopping</Text></Pressable><View style={styles.detailImageWrap}>{product.image ? <Image source={{ uri: product.image }} style={styles.detailImage} resizeMode="contain" /> : <View style={styles.imageFallback}><Text style={styles.imageFallbackText}>{niceCategory(product.category).slice(0,1)}</Text></View>}</View><View style={styles.detailContent}><Text style={styles.productCategory}>{niceCategory(product.category)}</Text><Text style={styles.detailTitle}>{product.name}</Text><Text style={styles.productSeller}>Sold by {product.seller}</Text><View style={styles.detailPriceRow}><Text style={styles.detailPrice}>{money(product.price)}</Text>{product.mrp > product.price && <Text style={styles.mrp}>{money(product.mrp)}</Text>}{product.mrp > product.price && <Text style={styles.discount}>{Math.round((1 - product.price / product.mrp) * 100)}% off</Text>}</View><View style={styles.codInfo}><Text style={styles.codInfoTitle}>Cash on Delivery available</Text><Text style={styles.codInfoBody}>Pay in cash when your order arrives. No online payment is collected.</Text></View><Text style={styles.detailSectionTitle}>About this product</Text><Text style={styles.detailDescription}>{product.description || 'A thoughtful find from an Omosis local seller.'}</Text><Text style={styles.detailSectionTitle}>Availability</Text><Text style={styles.detailDescription}>{product.stock > 0 ? `${product.stock} available` : 'Availability will be confirmed by the seller.'}</Text></View></ScrollView><View style={styles.bottomAction}><Button title="Add to bag" onPress={() => { addToCart(product); Alert.alert('Added to bag', `${product.name} was added to your bag.`); }} /><Button title="View bag" secondary onPress={() => navigation.navigate('Main', { screen: 'Bag' })} /></View></SafeAreaView>;
}
function BagScreen({ navigation }: any) {
  const { cart, changeQuantity, cartTotal } = useApp();
  return <SafeAreaView style={styles.screen}><ScrollView><Header title="Your bag" subtitle="Your local finds, ready when you are." />{cart.length ? <><View style={styles.cartList}>{cart.map((line: CartLine) => <View key={line.product.id} style={styles.cartItem}><View style={styles.cartThumb}>{line.product.image ? <Image source={{ uri: line.product.image }} style={styles.cartImage} /> : <Text style={styles.imageFallbackText}>{niceCategory(line.product.category).slice(0,1)}</Text>}</View><View style={styles.cartInfo}><Text style={styles.cartName}>{line.product.name}</Text><Text style={styles.productSeller}>{line.product.seller}</Text><Text style={styles.price}>{money(line.product.price)}</Text><View style={styles.quantityControl}><Pressable onPress={() => changeQuantity(line.product.id, -1)} style={styles.quantityButton}><Text style={styles.quantityButtonText}>−</Text></Pressable><Text style={styles.quantityValue}>{line.quantity}</Text><Pressable onPress={() => changeQuantity(line.product.id, 1)} style={styles.quantityButton}><Text style={styles.quantityButtonText}>+</Text></Pressable><Pressable onPress={() => changeQuantity(line.product.id, -line.quantity)}><Text style={styles.removeText}>Remove</Text></Pressable></View></View><Text style={styles.lineTotal}>{money(line.product.price * line.quantity)}</Text></View>)}</View><View style={styles.summaryCard}><Text style={styles.sectionTitle}>Order summary</Text><View style={styles.summaryLine}><Text style={styles.summaryLabel}>Items ({cart.reduce((n: number, x: CartLine) => n + x.quantity, 0)})</Text><Text style={styles.summaryValue}>{money(cartTotal)}</Text></View><View style={styles.summaryLine}><Text style={styles.summaryLabel}>Delivery</Text><Text style={styles.freeText}>Calculated by seller</Text></View><View style={[styles.summaryLine, { borderTopWidth: 1, borderTopColor: line, paddingTop: 14, marginTop: 8 }]}><Text style={styles.totalLabel}>Subtotal</Text><Text style={styles.totalValue}>{money(cartTotal)}</Text></View><Text style={styles.summaryHint}>Payment method: Cash on Delivery</Text><Button title="Continue to checkout" onPress={() => navigation.navigate('Checkout')} /></View></> : <Empty title="Your bag is empty" body="Explore local finds and add something you love." action="Explore products" onAction={() => navigation.navigate('Home')} />}</ScrollView></SafeAreaView>;
}
function CheckoutScreen({ navigation }: any) {
  const { user, cart, cartTotal, clearCart, loadProducts } = useApp();
  const [name, setName] = useState(''); const [phone, setPhone] = useState(''); const [address, setAddress] = useState(''); const [city, setCity] = useState(''); const [state, setState] = useState(''); const [pincode, setPincode] = useState(''); const [landmark, setLandmark] = useState(''); const [note, setNote] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const placeOrder = async () => {
    setError('');
    if (!user) { Alert.alert('Sign in required', 'Please sign in before placing your COD order.', [{ text: 'Cancel' }, { text: 'Sign in', onPress: () => navigation.navigate('Account') }]); return; }
    if (!cart.length) { setError('Your bag is empty.'); return; }
    if (!name.trim() || !/^\d{10}$/.test(phone.trim()) || !address.trim() || !city.trim() || !state.trim() || !/^\d{6}$/.test(pincode.trim())) { setError('Enter your name, valid 10-digit phone, address, city, state and 6-digit PIN code.'); return; }
    setBusy(true);
    try {
      // Refresh live product prices before preparing the order. Database-side validation is still required for production.
      const liveIds = cart.map(x => x.product.id).filter(id => !id.startsWith('p'));
      let liveMap: Record<string, any> = {};
      if (liveIds.length) {
        const { data, error: priceError } = await supabase.from('products').select('id,name,price,stock,active').in('id', liveIds);
        if (priceError) throw priceError;
        (data || []).forEach((p: any) => { liveMap[String(p.id)] = p; });
      }
      const orderItems = cart.map(line => {
        const live = liveMap[line.product.id];
        if (liveIds.includes(line.product.id) && (!live || live.active === false)) throw new Error(`${line.product.name} is no longer available. Please refresh products.`);
        if (live && Number(live.stock) < line.quantity) throw new Error(`Only ${live.stock} unit(s) of ${line.product.name} are available.`);
        const price = live ? Number(live.price) : line.product.price;
        return { product_id: line.product.id, product_name: live?.name || line.product.name, quantity: line.quantity, unit_price: price, line_total: price * line.quantity };
      });
      const total = orderItems.reduce((n, x) => n + x.line_total, 0);
      const orderNumber = `OMS-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      const payload = { order_number: orderNumber, user_id: user.id, customer_name: name.trim(), phone: phone.trim(), address: address.trim(), city: city.trim(), state: state.trim(), pincode: pincode.trim(), landmark: landmark.trim() || null, note: note.trim() || null, payment_method: 'COD', total, status: 'Pending' };
      const { data: order, error: orderError } = await supabase.from('orders').insert(payload).select('id,order_number').single();
      if (orderError) throw orderError;
      const { error: itemError } = await supabase.from('order_items').insert(orderItems.map(x => ({ ...x, order_id: order.id })));
      if (itemError) throw new Error(`Order ${orderNumber} was created, but its items could not be saved. Do not retry immediately; contact support. Details: ${itemError.message}`);
      clearCart(); await loadProducts();
      navigation.replace('OrderSuccess', { orderNumber, total });
    } catch (e: any) { setError(e?.message || 'Could not place your order. Check your internet connection and try again.'); }
    finally { setBusy(false); }
  };
  return <SafeAreaView style={styles.screen}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}><ScrollView keyboardShouldPersistTaps="handled"><Header title="Checkout" subtitle="Delivery details for your COD order." />{!user && <View style={styles.notice}><Text style={styles.noticeText}>Sign in is required to place an order.</Text><Button title="Go to account" onPress={() => navigation.navigate('Account')} /></View>}<View style={styles.formCard}><Text style={styles.sectionTitle}>Delivery address</Text><Field label="Full name" value={name} onChangeText={setName} /><Field label="Mobile number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="10-digit mobile number" /><Field label="House / street / locality" value={address} onChangeText={setAddress} /><View style={styles.twoFields}><View style={{ flex: 1 }}><Field label="City" value={city} onChangeText={setCity} /></View><View style={{ flex: 1 }}><Field label="State" value={state} onChangeText={setState} /></View></View><View style={styles.twoFields}><View style={{ flex: 1 }}><Field label="PIN code" value={pincode} onChangeText={setPincode} keyboardType="number-pad" placeholder="6-digit PIN" /></View><View style={{ flex: 1 }}><Field label="Landmark (optional)" value={landmark} onChangeText={setLandmark} /></View></View><Field label="Delivery note (optional)" value={note} onChangeText={setNote} multiline /><View style={styles.codInfo}><Text style={styles.codInfoTitle}>Cash on Delivery</Text><Text style={styles.codInfoBody}>No online payment is collected. Pay the seller/delivery partner when the order arrives.</Text></View><View style={styles.summaryLine}><Text style={styles.totalLabel}>Order subtotal</Text><Text style={styles.totalValue}>{money(cartTotal)}</Text></View>{!!error && <Text style={styles.errorText}>{error}</Text>}<Button title={busy ? 'Placing order…' : `Place COD order · ${money(cartTotal)}`} disabled={busy} onPress={placeOrder} /></View></ScrollView></KeyboardAvoidingView></SafeAreaView>;
}
function OrderSuccessScreen({ route, navigation }: any) { return <SafeAreaView style={styles.screen}><View style={styles.successWrap}><View style={styles.successIcon}><Text style={{ fontSize: 36, color: '#17845D' }}>✓</Text></View><Text style={styles.successTitle}>Order placed</Text><Text style={styles.successBody}>Your COD order request has been saved. You can view its status in your order history.</Text><View style={styles.summaryCard}><Text style={styles.summaryLabel}>Order number</Text><Text style={styles.orderNumber}>{route.params?.orderNumber}</Text><View style={styles.summaryLine}><Text style={styles.summaryLabel}>Total</Text><Text style={styles.totalValue}>{money(route.params?.total || 0)}</Text></View><Text style={styles.summaryHint}>Payment: Cash on Delivery</Text></View><Button title="View my orders" onPress={() => navigation.navigate('Main', { screen: 'Orders' })} /><Button title="Continue shopping" secondary onPress={() => navigation.navigate('Main', { screen: 'Home' })} /></View></SafeAreaView>; }
function OrdersScreen({ navigation }: any) {
  const { user } = useApp(); const [orders, setOrders] = useState<Order[]>([]); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const load = async () => { if (!user) { setOrders([]); return; } setBusy(true); setError(''); try { const { data, error: e } = await supabase.from('orders').select('*,order_items(*)').eq('user_id', user.id).order('created_at', { ascending: false }); if (e) throw e; setOrders(data || []); } catch (e: any) { setError(e.message || 'Could not load orders.'); } finally { setBusy(false); } };
  useEffect(() => { load(); }, [user?.id]);
  return <SafeAreaView style={styles.screen}><ScrollView refreshControl={<RefreshControl refreshing={busy} onRefresh={load} tintColor={purple} />}><Header title="Your orders" subtitle="Track purchases made with Omosis." />{!user ? <Empty title="Sign in to see your orders" body="Orders are private to your account." action="Open account" onAction={() => navigation.navigate('Account')} /> : error ? <Empty title="Could not load orders" body={error} action="Try again" onAction={load} /> : orders.length ? orders.map(order => <View key={String(order.id)} style={styles.orderCard}><View style={styles.orderTop}><View style={{ flex: 1 }}><Text style={styles.orderNumber}>{order.order_number || `Order ${order.id}`}</Text><Text style={styles.productSeller}>{order.created_at ? new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recent order'}</Text></View><View style={styles.statusPill}><Text style={styles.statusText}>{order.status || 'Pending'}</Text></View></View><View style={styles.orderItems}>{(order.order_items || []).map((item, i) => <Text key={item.id || i} style={styles.orderItemText}>{item.product_name || 'Product'} × {item.quantity || 1}</Text>)}</View><View style={styles.summaryLine}><Text style={styles.summaryLabel}>Cash on Delivery</Text><Text style={styles.totalValue}>{money(Number(order.total || 0))}</Text></View></View>) : <Empty title="No orders yet" body="Your placed orders will appear here." action="Explore products" onAction={() => navigation.navigate('Home')} />}</ScrollView></SafeAreaView>;
}
function AccountScreen() {
  const { user, signOut } = useApp(); const [mode, setMode] = useState<'login' | 'signup'>('login'); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [name, setName] = useState(''); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [error, setError] = useState('');
  const submit = async () => { setBusy(true); setError(''); setMessage(''); try { if (!email.trim() || !password) throw new Error('Enter your email and password.'); if (password.length < 6) throw new Error('Password must be at least 6 characters.'); if (mode === 'signup') { const { data, error: e } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { full_name: name.trim() } } }); if (e) throw e; if (!data.session) setMessage('Account created. Check your email to confirm your account, then sign in.'); else setMessage('Account created successfully.'); } else { const { error: e } = await supabase.auth.signInWithPassword({ email: email.trim(), password }); if (e) throw e; setMessage('Signed in successfully.'); } } catch (e: any) { setError(e.message || 'Authentication failed.'); } finally { setBusy(false); } };
  return <SafeAreaView style={styles.screen}><ScrollView keyboardShouldPersistTaps="handled"><Header title="Your account" subtitle="Sign in to manage orders and checkout." />{user ? <View style={styles.accountCard}><View style={styles.avatar}><Text style={styles.avatarText}>{(user.email || 'O').slice(0, 1).toUpperCase()}</Text></View><Text style={styles.accountName}>{user.user_metadata?.full_name || 'Omosis customer'}</Text><Text style={styles.accountEmail}>{user.email}</Text><View style={styles.accountDivider} /><View style={styles.accountFeature}><Text style={styles.accountFeatureTitle}>Customer account</Text><Text style={styles.accountFeatureBody}>Your orders and account are connected to Supabase.</Text></View><Button title="Sign out" secondary onPress={() => Alert.alert('Sign out?', 'You can sign in again at any time.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Sign out', style: 'destructive', onPress: async () => { const { error: e } = await signOut(); if (e) Alert.alert('Could not sign out', e.message); } }])} /></View> : <View style={styles.formCard}><View style={styles.authToggle}><Pressable onPress={() => { setMode('login'); setError(''); setMessage(''); }} style={[styles.authToggleItem, mode === 'login' && styles.authToggleActive]}><Text style={[styles.authToggleText, mode === 'login' && styles.authToggleTextActive]}>Login</Text></Pressable><Pressable onPress={() => { setMode('signup'); setError(''); setMessage(''); }} style={[styles.authToggleItem, mode === 'signup' && styles.authToggleActive]}><Text style={[styles.authToggleText, mode === 'signup' && styles.authToggleTextActive]}>Create account</Text></Pressable></View>{mode === 'signup' && <Field label="Full name (optional)" value={name} onChangeText={setName} /> }<Field label="Email address" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" /><Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" />{!!message && <Text style={styles.successText}>{message}</Text>}{!!error && <Text style={styles.errorText}>{error}</Text>}<Button title={busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'} disabled={busy} onPress={submit} /><Text style={styles.formFootnote}>If email confirmation is enabled in Supabase, follow the confirmation link before signing in.</Text></View>}<View style={styles.promiseCard}><Text style={styles.promiseTitle}>Omosis, for local shopping</Text><Text style={styles.promiseBody}>Discover products from local sellers. Pay by Cash on Delivery.</Text></View></ScrollView></SafeAreaView>;
}
function Empty({ title, body, action, onAction }: any) { return <View style={styles.emptyWrap}><View style={styles.emptyIcon}><Text style={{ fontSize: 24, color: purple }}>O</Text></View><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyBody}>{body}</Text>{!!action && <Button title={action} onPress={onAction} style={{ marginTop: 8 }} />}</View>; }
function MainTabs() {
  const { cartCount } = useApp();
  return <Tabs.Navigator screenOptions={{ headerShown: false, tabBarActiveTintColor: purple, tabBarInactiveTintColor: '#9892A6', tabBarStyle: styles.tabBar, tabBarLabelStyle: styles.tabLabel }}>
    <Tabs.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: 'Discover', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>⌂</Text> }} />
    <Tabs.Screen name="Bag" component={BagScreen} options={{ tabBarLabel: 'Bag', tabBarBadge: cartCount || undefined, tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 17 }}>▱</Text> }} />
    <Tabs.Screen name="Orders" component={OrdersScreen} options={{ tabBarLabel: 'Orders', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 17 }}>▤</Text> }} />
    <Tabs.Screen name="Account" component={AccountScreen} options={{ tabBarLabel: 'Account', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 17 }}>○</Text> }} />
  </Tabs.Navigator>;
}
type ChatMessage = { id: string; from: 'bot' | 'user'; text: string };
function OmosisChatbot() {
  const { products, cart, cartTotal, user } = useApp();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 'welcome', from: 'bot', text: 'Hey! 👋 I’m Omi, your Omosis shopping assistant. Ask me about products, your bag, COD, or orders.' },
  ]);
  const send = (raw?: string) => {
    const text = (raw ?? draft).trim();
    if (!text) return;
    const q = text.toLowerCase();
    let answer = 'I can help with product discovery, your bag, Cash on Delivery, and order tracking. Try asking “show me products”, “what is COD?”, or “how do I track my order?”';
    if (/\b(hi|hello|hey|namaste)\b/.test(q)) answer = 'Hey there! 👋 What are you looking for today? I can help you discover local products or explain how Omosis works.';
    else if (/(cod|cash on delivery|payment|pay)/.test(q)) answer = 'Omosis currently supports Cash on Delivery in this app. You can review your items and delivery details before placing your order.';
    else if (/(cart|bag|basket|subtotal|total)/.test(q)) answer = cart.length ? `Your bag has ${cart.reduce((n: number, item: CartLine) => n + item.quantity, 0)} item(s), with a subtotal of ${money(cartTotal)}. Open the Bag tab to change quantities or continue to checkout.` : 'Your bag is empty right now. Browse Discover and tap a product to add it to your bag.';
    else if (/(track|tracking|order status|my order|delivery status)/.test(q)) answer = user ? 'Open the Orders tab to see the status of orders linked to your account. If an order is missing, check that you signed in with the same account used at checkout.' : 'To view order history, sign in first, then open the Orders tab.';
    else if (/(return|refund|cancel|exchange)/.test(q)) answer = 'For a return, refund, exchange, or cancellation, contact the seller/support team with your order number before sending an item back. This app does not yet process returns automatically.';
    else if (/(seller|local shop|local store|vendor)/.test(q)) answer = 'Omosis helps customers discover products from local sellers. Browse the catalogue to see available items and their seller names.';
    else if (/(product|recommend|suggest|show me|find|looking for|shop|buy)/.test(q)) {
      const terms = q.split(/\W+/).filter((w: string) => w.length > 3 && !['product','products','recommend','suggest','show','looking','find','shop','buy','please','want','need','some','with','from','under'].includes(w));
      const matches = products.filter((p: Product) => terms.some((term: string) => `${p.name} ${p.category} ${p.description}`.toLowerCase().includes(term))).slice(0, 3);
      const picks = (matches.length ? matches : products.slice(0, 3));
      answer = picks.length ? `Here are a few ${matches.length ? 'matches' : 'things to explore'} from the current catalogue:\n${picks.map((p: Product) => `• ${p.name} — ${money(p.price)} (${p.seller || 'local seller'})`).join('\n')}\nOpen Discover to view the product details and add an item to your bag.` : 'I couldn’t find products in the catalogue right now. Please try again in a moment.';
    }
    setMessages(prev => [...prev, { id: `${Date.now()}-u`, from: 'user', text }, { id: `${Date.now()}-b`, from: 'bot', text: answer }]);
    setDraft('');
  };
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel="Open Omosis shopping assistant" onPress={() => setOpen(true)} style={styles.chatFab}>
      <Text style={styles.chatFabIcon}>✦</Text><View style={styles.chatOnlineDot} />
    </Pressable>
    <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
      <View style={styles.chatModalBackdrop}>
        <Pressable style={styles.chatBackdropTap} onPress={() => setOpen(false)} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.chatSheet}>
          <View style={styles.chatHeader}>
            <View style={styles.chatAvatar}><Text style={styles.chatAvatarText}>O</Text></View>
            <View style={{ flex: 1 }}><Text style={styles.chatTitle}>Omosis Assistant</Text><Text style={styles.chatSubtitle}>Shopping help · Usually instant</Text></View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close chat" onPress={() => setOpen(false)} style={styles.chatClose}><Text style={styles.chatCloseText}>×</Text></Pressable>
          </View>
          <ScrollView style={styles.chatMessages} contentContainerStyle={{ padding: 14, gap: 10 }} keyboardShouldPersistTaps="handled">
            {messages.map(m => <View key={m.id} style={[styles.chatBubble, m.from === 'user' ? styles.chatUserBubble : styles.chatBotBubble]}><Text style={[styles.chatBubbleText, m.from === 'user' && styles.chatUserText]}>{m.text}</Text></View>)}
            <View style={styles.chatQuickReplies}>{['Find products', 'COD & payments', 'Track my order'].map(item => <Pressable key={item} onPress={() => send(item)} style={styles.chatQuickReply}><Text style={styles.chatQuickReplyText}>{item}</Text></Pressable>)}</View>
          </ScrollView>
          <View style={styles.chatComposer}><TextInput value={draft} onChangeText={setDraft} placeholder="Ask Omi anything…" placeholderTextColor="#9992AA" style={styles.chatInput} returnKeyType="send" onSubmitEditing={() => send()} /><Pressable accessibilityRole="button" accessibilityLabel="Send message" onPress={() => send()} style={styles.chatSend}><Text style={styles.chatSendText}>↑</Text></Pressable></View>
          <Text style={styles.chatDisclaimer}>Omi uses built-in help responses; verify order and return details in your account.</Text>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  </>;
}

export default function App() {
  return <AppProvider><NavigationContainer><ExpoStatusBar style="dark" backgroundColor={bg} /><Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: bg }, animation: 'slide_from_right' }}><Stack.Screen name="Main" component={MainTabs} /><Stack.Screen name="Product" component={ProductScreen} /><Stack.Screen name="Checkout" component={CheckoutScreen} /><Stack.Screen name="OrderSuccess" component={OrderSuccessScreen} /></Stack.Navigator></NavigationContainer><OmosisChatbot /></AppProvider>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: bg }, header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 14 }, brandRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 }, logo: { width: 34, height: 34, borderRadius: 12, backgroundColor: purple, alignItems: 'center', justifyContent: 'center', marginRight: 9 }, logoText: { color: '#fff', fontSize: 22, fontWeight: '800' }, brand: { fontSize: 22, fontWeight: '800', color: ink, letterSpacing: -.7 }, codPill: { paddingHorizontal: 11, paddingVertical: 6, backgroundColor: '#E9F8F1', borderRadius: 20 }, codText: { color: '#16805B', fontSize: 10, fontWeight: '800', letterSpacing: .8 }, pageTitle: { color: ink, fontSize: 27, lineHeight: 33, fontWeight: '800', letterSpacing: -.8 }, pageSubtitle: { marginTop: 5, color: muted, fontSize: 13, lineHeight: 19 }, searchWrap: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, backgroundColor: '#fff', borderRadius: 15, borderWidth: 1, borderColor: line, paddingHorizontal: 14, height: 50 }, searchIcon: { color: purple, fontSize: 24, marginRight: 8 }, searchInput: { flex: 1, fontSize: 14, color: ink }, chipRow: { paddingHorizontal: 20, paddingVertical: 15, gap: 8 }, chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 24, borderWidth: 1, borderColor: line, backgroundColor: '#fff' }, chipActive: { backgroundColor: purple, borderColor: purple }, chipText: { color: muted, fontSize: 12, fontWeight: '700' }, chipTextActive: { color: '#fff' }, sectionTitleRow: { paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 3, marginBottom: 12, gap: 8 }, sectionTitle: { color: ink, fontSize: 18, fontWeight: '800', letterSpacing: -.3 }, sectionSubtitle: { color: muted, fontSize: 11, marginTop: 3 }, sortRow: { flexDirection: 'row', gap: 4 }, sortChip: { paddingHorizontal: 7, paddingVertical: 6, borderRadius: 8 }, sortChipActive: { backgroundColor: '#EEE9FF' }, sortText: { color: muted, fontSize: 10, fontWeight: '700' }, productGrid: { paddingHorizontal: 16, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }, productCard: { width: '48.2%', backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: line, padding: 9, marginBottom: 12 }, productImageWrap: { height: 150, backgroundColor: '#F3F0FA', borderRadius: 11, overflow: 'hidden', marginBottom: 10 }, productImage: { width: '100%', height: '100%' }, imageFallback: { flex: 1, backgroundColor: '#EEE9FF', alignItems: 'center', justifyContent: 'center' }, imageFallbackText: { fontSize: 40, color: purple, fontWeight: '800' }, productName: { color: ink, fontSize: 13, fontWeight: '800' }, productSeller: { color: muted, fontSize: 10, marginTop: 4 }, priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }, price: { color: ink, fontSize: 15, fontWeight: '800' }, mrp: { color: '#A5A0AF', fontSize: 11, textDecorationLine: 'line-through' }, productCategory: { color: purple, fontSize: 10, fontWeight: '700', marginTop: 6 }, notice: { marginHorizontal: 20, marginBottom: 14, padding: 12, borderRadius: 12, backgroundColor: '#FFF6E5', borderWidth: 1, borderColor: '#F5E3B9' }, noticeText: { color: '#76551B', fontSize: 12, lineHeight: 18 }, promiseCard: { marginHorizontal: 20, marginVertical: 16, borderRadius: 16, backgroundColor: '#EEE9FF', padding: 18 }, promiseTitle: { color: ink, fontSize: 16, fontWeight: '800' }, promiseBody: { color: muted, fontSize: 12, lineHeight: 18, marginTop: 6 }, button: { minHeight: 49, borderRadius: 14, backgroundColor: purple, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, marginTop: 10 }, buttonText: { color: '#fff', fontSize: 14, fontWeight: '800' }, buttonSecondary: { backgroundColor: '#F1EEFA', borderWidth: 1, borderColor: '#E1DAFA' }, buttonSecondaryText: { color: purple }, backLink: { paddingHorizontal: 20, paddingVertical: 12 }, backLinkText: { color: purple, fontWeight: '700', fontSize: 13 }, detailImageWrap: { height: 310, marginHorizontal: 20, borderRadius: 20, overflow: 'hidden', backgroundColor: '#fff', borderWidth: 1, borderColor: line }, detailImage: { width: '100%', height: '100%' }, detailContent: { padding: 20, paddingBottom: 26 }, detailTitle: { color: ink, fontSize: 25, fontWeight: '800', marginTop: 5, letterSpacing: -.6 }, detailPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 14 }, detailPrice: { color: ink, fontSize: 25, fontWeight: '900' }, discount: { color: '#16805B', fontSize: 12, fontWeight: '800' }, codInfo: { backgroundColor: '#F0FBF6', borderWidth: 1, borderColor: '#D5F2E4', borderRadius: 14, padding: 14, marginTop: 18 }, detailSectionTitle: { color: ink, fontSize: 16, fontWeight: '800', marginTop: 22, marginBottom: 7 }, detailDescription: { color: muted, fontSize: 13, lineHeight: 21 }, bottomAction: { flexDirection: 'row', gap: 10, padding: 14, borderTopWidth: 1, borderTopColor: line, backgroundColor: '#fff' }, cartList: { paddingHorizontal: 16 }, cartItem: { backgroundColor: '#fff', borderRadius: 15, borderWidth: 1, borderColor: line, padding: 11, flexDirection: 'row', gap: 11, marginBottom: 10 }, cartThumb: { width: 78, height: 88, backgroundColor: '#F3F0FA', borderRadius: 11, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }, cartImage: { width: '100%', height: '100%' }, cartInfo: { flex: 1, justifyContent: 'center' }, cartName: { color: ink, fontSize: 13, fontWeight: '800' }, quantityControl: { flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 9 }, quantityButton: { width: 27, height: 27, borderRadius: 8, backgroundColor: '#F0ECFC', alignItems: 'center', justifyContent: 'center' }, quantityButtonText: { color: purple, fontSize: 18, fontWeight: '800', lineHeight: 20 }, quantityValue: { color: ink, fontWeight: '800' }, removeText: { color: '#B54747', fontSize: 11, fontWeight: '700', marginLeft: 2 }, lineTotal: { color: ink, fontSize: 12, fontWeight: '800', alignSelf: 'center' }, summaryCard: { marginHorizontal: 20, marginTop: 8, padding: 17, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: line, marginBottom: 20 }, summaryLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 13, gap: 8 }, summaryLabel: { color: muted, fontSize: 12 }, summaryValue: { color: ink, fontSize: 12, fontWeight: '700' }, freeText: { color: '#16805B', fontSize: 11, fontWeight: '700' }, totalLabel: { color: ink, fontSize: 14, fontWeight: '800' }, totalValue: { color: ink, fontSize: 17, fontWeight: '900' }, summaryHint: { color: muted, fontSize: 11, marginTop: 13 }, emptyWrap: { paddingHorizontal: 28, paddingVertical: 46, alignItems: 'center' }, emptyIcon: { width: 58, height: 58, borderRadius: 20, backgroundColor: '#EEE9FF', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }, emptyTitle: { color: ink, fontSize: 18, fontWeight: '800', textAlign: 'center' }, emptyBody: { color: muted, fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 8, marginBottom: 6 }, formCard: { marginHorizontal: 20, padding: 17, borderRadius: 17, backgroundColor: '#fff', borderWidth: 1, borderColor: line, marginBottom: 18 }, fieldWrap: { marginTop: 13 }, fieldLabel: { color: ink, fontSize: 12, fontWeight: '700', marginBottom: 7 }, input: { borderWidth: 1, borderColor: line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, minHeight: 46, color: ink, fontSize: 13, backgroundColor: '#FCFBFE' }, twoFields: { flexDirection: 'row', gap: 10 }, errorText: { color: '#B42318', fontSize: 12, lineHeight: 18, marginTop: 12 }, successText: { color: '#16805B', fontSize: 12, lineHeight: 18, marginTop: 12 }, formFootnote: { color: muted, fontSize: 11, lineHeight: 17, marginTop: 13 }, codInfoTitle: { color: '#176C4D', fontWeight: '800', fontSize: 13 }, authToggle: { flexDirection: 'row', backgroundColor: '#F4F1FA', borderRadius: 12, padding: 4, marginBottom: 5 }, authToggleItem: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 9 }, authToggleActive: { backgroundColor: '#fff', elevation: 1 }, authToggleText: { color: muted, fontSize: 12, fontWeight: '700' }, authToggleTextActive: { color: purple }, accountCard: { marginHorizontal: 20, padding: 22, backgroundColor: '#fff', borderWidth: 1, borderColor: line, borderRadius: 18, alignItems: 'center' }, avatar: { width: 66, height: 66, borderRadius: 23, backgroundColor: '#EEE9FF', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }, avatarText: { color: purple, fontSize: 27, fontWeight: '800' }, accountName: { color: ink, fontSize: 19, fontWeight: '800' }, accountEmail: { color: muted, fontSize: 12, marginTop: 4 }, accountDivider: { height: 1, backgroundColor: line, width: '100%', marginVertical: 20 }, accountFeature: { width: '100%', backgroundColor: '#F8F6FC', padding: 13, borderRadius: 12 }, accountFeatureTitle: { color: ink, fontSize: 13, fontWeight: '800' }, accountFeatureBody: { color: muted, fontSize: 11, lineHeight: 17, marginTop: 4 }, successWrap: { flex: 1, justifyContent: 'center', padding: 24 }, successIcon: { width: 70, height: 70, borderRadius: 24, backgroundColor: '#E6F8EF', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 18 }, successTitle: { color: ink, fontSize: 28, fontWeight: '900', textAlign: 'center' }, successBody: { color: muted, fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 8, marginBottom: 18 }, orderNumber: { color: ink, fontSize: 13, fontWeight: '800', marginTop: 5 }, orderCard: { marginHorizontal: 20, marginBottom: 12, padding: 16, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: line }, orderTop: { flexDirection: 'row', alignItems: 'center', gap: 8 }, statusPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F1EEFA' }, statusText: { color: purple, fontSize: 10, fontWeight: '800' }, orderItems: { marginTop: 14, borderTopWidth: 1, borderTopColor: line, paddingTop: 10 }, orderItemText: { color: muted, fontSize: 12, marginVertical: 3 }, tabBar: { height: 63, paddingTop: 6, paddingBottom: 5, borderTopColor: line, backgroundColor: '#fff' }, tabLabel: { fontSize: 10, fontWeight: '700' },
  chatFab: { position: 'absolute', right: 18, bottom: 82, width: 58, height: 58, borderRadius: 22, backgroundColor: purple, alignItems: 'center', justifyContent: 'center', elevation: 8, shadowColor: '#352078', shadowOpacity: .28, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, borderWidth: 3, borderColor: '#FFFFFF' }, chatFabIcon: { color: '#FFFFFF', fontSize: 29, fontWeight: '700', marginTop: -2 }, chatOnlineDot: { position: 'absolute', right: 1, top: 1, width: 12, height: 12, borderRadius: 6, backgroundColor: '#2CC58A', borderWidth: 2, borderColor: '#FFFFFF' },
  chatModalBackdrop: { flex: 1, backgroundColor: 'rgba(25,18,48,.25)', justifyContent: 'flex-end' }, chatBackdropTap: { flex: 1 }, chatSheet: { height: '76%', minHeight: 420, backgroundColor: '#FFFFFF', borderTopLeftRadius: 25, borderTopRightRadius: 25, overflow: 'hidden' }, chatHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: line, backgroundColor: '#FFFFFF' }, chatAvatar: { width: 42, height: 42, borderRadius: 15, backgroundColor: purple, alignItems: 'center', justifyContent: 'center', marginRight: 11 }, chatAvatarText: { color: '#FFFFFF', fontSize: 23, fontWeight: '900' }, chatTitle: { color: ink, fontSize: 15, fontWeight: '800' }, chatSubtitle: { color: '#16805B', fontSize: 11, marginTop: 3 }, chatClose: { width: 34, height: 34, borderRadius: 12, backgroundColor: '#F2EFFB', alignItems: 'center', justifyContent: 'center' }, chatCloseText: { color: purple, fontSize: 26, lineHeight: 29 }, chatMessages: { flex: 1, backgroundColor: '#FBFAFE' }, chatBubble: { maxWidth: '88%', paddingHorizontal: 13, paddingVertical: 11, borderRadius: 16 }, chatBotBubble: { alignSelf: 'flex-start', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: line, borderBottomLeftRadius: 5 }, chatUserBubble: { alignSelf: 'flex-end', backgroundColor: purple, borderBottomRightRadius: 5 }, chatBubbleText: { color: ink, fontSize: 13, lineHeight: 19 }, chatUserText: { color: '#FFFFFF' }, chatQuickReplies: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 4 }, chatQuickReply: { borderWidth: 1, borderColor: '#DCD3FF', backgroundColor: '#F4F0FF', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 18 }, chatQuickReplyText: { color: purple, fontSize: 11, fontWeight: '700' }, chatComposer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, paddingVertical: 10, gap: 9, borderTopWidth: 1, borderTopColor: line, backgroundColor: '#FFFFFF' }, chatInput: { flex: 1, minHeight: 44, maxHeight: 90, borderRadius: 15, borderWidth: 1, borderColor: line, backgroundColor: '#FBFAFE', paddingHorizontal: 13, color: ink, fontSize: 13 }, chatSend: { width: 43, height: 43, borderRadius: 15, backgroundColor: purple, alignItems: 'center', justifyContent: 'center' }, chatSendText: { color: '#FFFFFF', fontSize: 25, fontWeight: '800', marginTop: -3 }, chatDisclaimer: { color: '#8A8498', fontSize: 9, textAlign: 'center', paddingBottom: 8, paddingHorizontal: 12, backgroundColor: '#FFFFFF' }
});
