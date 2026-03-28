import { useEffect, useRef, useState, useCallback } from 'react';

export default function useWebRTC(socket, roomCode, players, myId) {
    const [localStream, setLocalStream] = useState(null);
    const [isMuted, setIsMuted] = useState(true);
    const [speakingUsers, setSpeakingUsers] = useState(new Set());
    const [micReady, setMicReady] = useState(false);
    const [voiceConnected, setVoiceConnected] = useState(false);
    
    const peersRef = useRef({});
    const localStreamRef = useRef(null);
    const localAnimFrameRef = useRef(null);

    // ─── 1. Get Microphone access (non-blocking) ───
    useEffect(() => {
        const getMedia = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
                stream.getAudioTracks().forEach(track => track.enabled = false); // Start muted
                localStreamRef.current = stream;
                setLocalStream(stream);
                setMicReady(true);
                console.log('[WebRTC] Microphone acquired successfully');

                // Add local tracks to any existing peer connections
                for (const peerId in peersRef.current) {
                    const peer = peersRef.current[peerId];
                    const senders = peer.getSenders();
                    if (senders.length === 0) {
                        stream.getTracks().forEach(track => {
                            peer.addTrack(track, stream);
                        });
                        console.log(`[WebRTC] Added local tracks to existing peer ${peerId}`);
                    }
                }
            } catch (err) {
                console.warn("[WebRTC] Microphone access denied — you can still hear others:", err.message);
                setMicReady(false);
            }
        };
        getMedia();

        return () => {
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach(track => track.stop());
            }
            if (localAnimFrameRef.current) {
                cancelAnimationFrame(localAnimFrameRef.current);
            }
        };
    }, []);

    // ─── 2. Local speaking detection ───
    useEffect(() => {
        if (!localStreamRef.current || !myId) return;

        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioCtx.createMediaStreamSource(localStreamRef.current);
        const analyzer = audioCtx.createAnalyser();
        analyzer.fftSize = 256;
        source.connect(analyzer);

        const dataArray = new Uint8Array(analyzer.frequencyBinCount);
        let wasSpeaking = false;

        const checkLocalAudio = () => {
            analyzer.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
            const avg = sum / dataArray.length;
            const isSpeaking = avg > 15;

            if (isSpeaking !== wasSpeaking) {
                wasSpeaking = isSpeaking;
                setSpeakingUsers(prev => {
                    const next = new Set(prev);
                    if (isSpeaking) next.add(myId);
                    else next.delete(myId);
                    return next;
                });
                if (socket && roomCode) {
                    socket.emit('speaking_update', { roomCode, isSpeaking });
                }
            }
            localAnimFrameRef.current = requestAnimationFrame(checkLocalAudio);
        };
        checkLocalAudio();

        return () => {
            if (localAnimFrameRef.current) cancelAnimationFrame(localAnimFrameRef.current);
            audioCtx.close();
        };
    }, [micReady, myId, socket, roomCode]);

    // ─── 3. Socket-based speaking indicator (always works) ───
    useEffect(() => {
        if (!socket) return;
        const handleSpeakingUpdate = ({ playerId, isSpeaking }) => {
            setSpeakingUsers(prev => {
                const next = new Set(prev);
                if (isSpeaking) next.add(playerId);
                else next.delete(playerId);
                return next;
            });
        };
        socket.on('speaking_update', handleSpeakingUpdate);
        return () => socket.off('speaking_update', handleSpeakingUpdate);
    }, [socket]);

    // ─── 4. Mute toggle ───
    const toggleMute = () => {
        if (localStreamRef.current) {
            const newState = !isMuted;
            localStreamRef.current.getAudioTracks().forEach(track => track.enabled = !newState);
            setIsMuted(newState);
            if (newState) {
                setSpeakingUsers(prev => {
                    const next = new Set(prev);
                    next.delete(myId);
                    return next;
                });
                if (socket && roomCode) {
                    socket.emit('speaking_update', { roomCode, isSpeaking: false });
                }
            }
        }
    };

    // ─── 5. Create a peer connection (works with or without mic) ───
    const createPeerConnection = useCallback((targetId) => {
        // Close existing connection to this target
        if (peersRef.current[targetId]) {
            peersRef.current[targetId].close();
            delete peersRef.current[targetId];
        }

        const peer = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
            ]
        });

        peersRef.current[targetId] = peer;

        // Add local tracks if mic is available (optional — receiving still works without)
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => {
                peer.addTrack(track, localStreamRef.current);
            });
        } else {
            // Add a silent placeholder track so the peer can negotiate audio
            // Without this, some browsers won't create audio transceivers
            peer.addTransceiver('audio', { direction: 'recvonly' });
            console.log(`[WebRTC] No mic — set to receive-only for ${targetId}`);
        }

        // Connection monitoring
        peer.oniceconnectionstatechange = () => {
            console.log(`[WebRTC] ICE state with ${targetId}: ${peer.iceConnectionState}`);
            if (peer.iceConnectionState === 'failed') {
                console.warn(`[WebRTC] Connection to ${targetId} failed, restarting ICE...`);
                peer.restartIce();
            }
        };

        peer.onconnectionstatechange = () => {
            console.log(`[WebRTC] Connection state with ${targetId}: ${peer.connectionState}`);
            if (peer.connectionState === 'connected') {
                setVoiceConnected(true);
            } else if (peer.connectionState === 'disconnected' || peer.connectionState === 'failed' || peer.connectionState === 'closed') {
                setVoiceConnected(false);
            }
        };

        peer.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('webrtc_ice_candidate', { targetId, candidate: event.candidate });
            }
        };

        peer.ontrack = (event) => {
            console.log(`[WebRTC] ✅ Received remote audio track from ${targetId}`, event.track.kind, event.track.readyState);
            const [remoteStream] = event.streams;
            console.log(`[WebRTC] Remote stream tracks:`, remoteStream.getTracks().map(t => `${t.kind}:${t.readyState}:enabled=${t.enabled}`));

            // Remove existing audio element for this peer
            const existing = document.getElementById(`audio-${targetId}`);
            if (existing) existing.remove();

            const audioElem = document.createElement('audio');
            audioElem.id = `audio-${targetId}`;
            audioElem.autoplay = true;
            audioElem.playsInline = true;
            audioElem.srcObject = remoteStream;
            document.body.appendChild(audioElem);

            // Handle autoplay restrictions
            const playPromise = audioElem.play();
            if (playPromise) {
                playPromise.catch(() => {
                    console.warn('[WebRTC] Autoplay blocked — will play on next click');
                    const resume = () => {
                        audioElem.play().catch(() => {});
                        document.removeEventListener('click', resume);
                    };
                    document.addEventListener('click', resume);
                });
            }
        };

        return peer;
    }, [socket]);

    // ─── 6. WebRTC signaling (NO mic dependency!) ───
    useEffect(() => {
        if (!socket || !roomCode || !myId) return;

        const handleOffer = async ({ sdp, callerId }) => {
            try {
                console.log(`[WebRTC] Received offer from ${callerId}`);
                const peer = createPeerConnection(callerId);
                await peer.setRemoteDescription(new RTCSessionDescription(sdp));
                const answer = await peer.createAnswer();
                await peer.setLocalDescription(answer);
                socket.emit('webrtc_answer', { targetId: callerId, sdp: answer });
                console.log(`[WebRTC] Sent answer to ${callerId}`);
            } catch (err) {
                console.error(`[WebRTC] Error handling offer from ${callerId}:`, err);
            }
        };

        const handleAnswer = async ({ sdp, answererId }) => {
            try {
                const peer = peersRef.current[answererId];
                if (peer && peer.signalingState !== 'stable') {
                    await peer.setRemoteDescription(new RTCSessionDescription(sdp));
                    console.log(`[WebRTC] Set answer from ${answererId}`);
                }
            } catch (err) {
                console.error(`[WebRTC] Error handling answer from ${answererId}:`, err);
            }
        };

        const handleIceCandidate = ({ candidate, senderId }) => {
            const peer = peersRef.current[senderId];
            if (peer && candidate) {
                peer.addIceCandidate(new RTCIceCandidate(candidate))
                    .catch(e => console.error(`[WebRTC] ICE error from ${senderId}:`, e));
            }
        };

        socket.on('webrtc_offer', handleOffer);
        socket.on('webrtc_answer', handleAnswer);
        socket.on('webrtc_ice_candidate', handleIceCandidate);

        return () => {
            socket.off('webrtc_offer', handleOffer);
            socket.off('webrtc_answer', handleAnswer);
            socket.off('webrtc_ice_candidate', handleIceCandidate);
        };
    }, [socket, roomCode, myId, createPeerConnection]);

    // ─── 7. Mesh network — connect to peers (NO mic dependency!) ───
    useEffect(() => {
        if (!players || !myId || !socket) return;

        // Cleanup peers that left
        const playerIds = players.map(p => p.id);
        for (const peerId in peersRef.current) {
            if (!playerIds.includes(peerId)) {
                console.log(`[WebRTC] Cleaning up peer ${peerId} (left)`);
                peersRef.current[peerId].close();
                delete peersRef.current[peerId];
                const audioElem = document.getElementById(`audio-${peerId}`);
                if (audioElem) audioElem.remove();
                setSpeakingUsers(prev => {
                    const next = new Set(prev);
                    next.delete(peerId);
                    return next;
                });
            }
        }

        // Connect to new peers
        players.forEach(p => {
            if (p.id !== myId && !p.isBot && !peersRef.current[p.id]) {
                console.log(`[WebRTC] Creating peer connection to ${p.username} (${p.id})`);
                const peer = createPeerConnection(p.id);
                // Only "greater" ID initiates to prevent double-offers
                if (myId > p.id) {
                    peer.createOffer()
                        .then(offer => peer.setLocalDescription(offer))
                        .then(() => {
                            console.log(`[WebRTC] Sending offer to ${p.id}`);
                            socket.emit('webrtc_offer', {
                                targetId: p.id,
                                sdp: peer.localDescription
                            });
                        })
                        .catch(err => console.error(`[WebRTC] Offer error to ${p.id}:`, err));
                }
            }
        });
    }, [players, myId, socket, createPeerConnection]);

    // ─── 8. Cleanup on unmount ───
    useEffect(() => {
        return () => {
            for (const peerId in peersRef.current) {
                peersRef.current[peerId].close();
                const audioElem = document.getElementById(`audio-${peerId}`);
                if (audioElem) audioElem.remove();
            }
            peersRef.current = {};
        };
    }, []);

    return { isMuted, toggleMute, speakingUsers, voiceConnected };
}
