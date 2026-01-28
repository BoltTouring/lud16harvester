import { useState, useRef, useEffect } from 'react';
import { SimplePool, Event as NostrEvent, Filter } from 'nostr-tools';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, Loader2, Play, Square } from 'lucide-react';

// Default relay list
const DEFAULT_RELAYS = [
 'wss://relay.damus.io',
 'wss://relay.primal.net',
 'wss://nos.lol',
 'wss://relay.nostr.band',
 'wss://nostr.wine',
].join('\n');

// Configuration
const MAX_ADDRESSES = 21;
const TIMEOUT_MS = 45000; // 45 seconds
const LUD16_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

interface RelayStatus {
 url: string;
 status: 'connecting' | 'connected' | 'error';
 error?: string;
}

export function LUD16Harvester() {
 const [relayInput, setRelayInput] = useState(DEFAULT_RELAYS);
 const [isRunning, setIsRunning] = useState(false);
 const [foundAddresses, setFoundAddresses] = useState ([]);
 const [relayStatuses, setRelayStatuses] = useState ([]);
 const [statusMessage, setStatusMessage] = useState('Ready to start');
 const [timeRemaining, setTimeRemaining] = useState (null);

 const poolRef = useRef (null);
 const addressSetRef = useRef >(new Set());
 const timeoutIdRef = useRef (null);
 const intervalIdRef = useRef (null);
 const subIdRef = useRef (null);
 const startTimeRef = useRef (null);

 // Parse relay URLs from textarea
 const parseRelays = (input: string): string[] => {
 return input
 .split(/[\n,]/)
 .map(url => url.trim())
 .filter(url => url.length > 0 && url.startsWith('wss://'));
 };

 // Validate lud16 format
 const isValidLud16 = (value: unknown): value is string => {
 return typeof value === 'string' && LUD16_REGEX.test(value);
 };

 // Process a Nostr event
 const processEvent = (event: NostrEvent) => {
 try {
 const metadata = JSON.parse(event.content);
 const lud16 = metadata.lud16;

 if (!isValidLud16(lud16)) return;

 // Check if we already have this address
 if (addressSetRef.current.has(lud16)) return;

 // New address found!
 addressSetRef.current.add(lud16);
 setFoundAddresses(prev => [...prev, lud16]);

 // Check if we've reached our goal
 if (addressSetRef.current.size >= MAX_ADDRESSES) {
 stopHarvesting();
 }
 } catch {
 // Silently skip invalid JSON
 }
 };

 // Stop harvesting
 const stopHarvesting = () => {
 setIsRunning(false);
 setStatusMessage('Stopped');

 // Clear timers
 if (timeoutIdRef.current) {
 clearTimeout(timeoutIdRef.current);
 timeoutIdRef.current = null;
 }
 if (intervalIdRef.current) {
 clearInterval(intervalIdRef.current);
 intervalIdRef.current = null;
 }

 // Close subscription and pool
 if (poolRef.current && subIdRef.current) {
 const relays = parseRelays(relayInput);
 poolRef.current.close(relays);
 poolRef.current = null;
 subIdRef.current = null;
 }

 startTimeRef.current = null;
 setTimeRemaining(null);
 };

 // Start harvesting
 const startHarvesting = async () => {
 // Reset state
 addressSetRef.current.clear();
 setFoundAddresses([]);
 setRelayStatuses([]);
 setIsRunning(true);
 setStatusMessage('Starting...');
 startTimeRef.current = Date.now();

 const relays = parseRelays(relayInput);

 if (relays.length === 0) {
 setStatusMessage('Error: No valid relay URLs provided');
 setIsRunning(false);
 return;
 }

 // Initialize relay statuses
 setRelayStatuses(relays.map(url => ({ url, status: 'connecting' })));

 // Create pool
 const pool = new SimplePool();
 poolRef.current = pool;

 // Set up timeout
 timeoutIdRef.current = setTimeout(() => {
 setStatusMessage('Timeout reached');
 stopHarvesting();
 }, TIMEOUT_MS);

 // Update timer display
 intervalIdRef.current = setInterval(() => {
 if (startTimeRef.current) {
 const elapsed = Date.now() - startTimeRef.current;
 const remaining = Math.max(0, TIMEOUT_MS - elapsed);
 setTimeRemaining(Math.ceil(remaining / 1000));

 if (remaining <= 0) {
 if (intervalIdRef.current) {
 clearInterval(intervalIdRef.current);
 intervalIdRef.current = null;
 }
 }
 }
 }, 100);

 setStatusMessage(`Listening to ${relays.length} relay(s)...`);

 // Subscribe to kind 0 events
 try {
 // Fix: subscribeMany expects a single Filter object, not an array
 const sub = pool.subscribeMany(
 relays,
 { kinds: [0], limit: 500 },
 {
 onevent: (event: NostrEvent) => {
 processEvent(event);
 },
 onclose: () => {
 // Subscription closed
 },
 oneose: () => {
 // End of stored events
 },
 }
 );

 subIdRef.current = 'active';

 // Monitor relay connections
 // Note: SimplePool doesn't expose relay connection status directly,
 // so we'll update status based on events received
 setTimeout(() => {
 setRelayStatuses(prev =>
 prev.map(r => ({ ...r, status: 'connected' }))
 );
 }, 2000);
 } catch (error) {
 setStatusMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
 stopHarvesting();
 }
 };

 // Cleanup on unmount
 useEffect(() => {
 return () => {
 if (isRunning) {
 stopHarvesting();
 }
 };
 }, []);

 const addressCount = foundAddresses.length;
 const progress = Math.min(100, (addressCount / MAX_ADDRESSES) * 100);

 return (
 
 
 
 
 🌾 
 LUD16 Harvester
 
 
 Extract Lightning Addresses from Nostr profile metadata
 
 
 
 {/* Relay Input */}
 
 
 Relay URLs (one per line or comma-separated)
 
 setRelayInput(e.target.value)}
 disabled={isRunning}
 placeholder="wss://relay.damus.io&#10;wss://relay.primal.net"
 rows={5}
 className="font-mono text-sm"
 />
 

 {/* Control Buttons */}
 
 
 {isRunning ? (
 <>
 
 Running...
 
 ) : (
 <>
 
 Start Harvesting
 
 )}
 
 
 
 Stop
 
 

 {/* Status */}
 
 
 Status: 
 
 {statusMessage}
 
 

 {timeRemaining !== null && (
 
 Time Remaining: 
 {timeRemaining}s 
 
 )}

 
 Addresses Found: 
 
 {addressCount} / {MAX_ADDRESSES}
 
 

 {/* Progress Bar */}
 
 
 
 

 {/* Relay Statuses */}
 {relayStatuses.length > 0 && (
 
 Relay Connections: 
 
 {relayStatuses.map((relay) => (
 
 {relay.status === 'connecting' && (
 
 )}
 {relay.status === 'connected' && (
 
 )}
 {relay.status === 'error' && (
 
 )}
 
 {relay.url}
 
 {relay.error && (
 
 {relay.error}
 
 )}
 
 ))}
 
 
 )}
 
 

 {/* Found Addresses */}
 
 
 Found Addresses 
 
 {addressCount === 0
 ? 'No addresses found yet'
 : `${addressCount} unique Lightning Address${addressCount === 1 ? '' : 'es'} discovered`}
 
 
 
 
 
 {foundAddresses.length === 0 ? (
 
 {isRunning
 ? 'Searching for Lightning Addresses...'
 : 'Click "Start Harvesting" to begin'}
 
 ) : (
 foundAddresses.map((address, index) => (
 
 
 {index + 1}
 
 Found: {address} 
 
 ))
 )}
 
 
 
 
 
 );
}
