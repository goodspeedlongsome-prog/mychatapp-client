import './App.css';
import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import './App.css';

const socket = io('http://localhost:3000');

function App() {
  const [roomId, setRoomId] = useState('');
  const [userName, setUserName] = useState('');
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [file, setFile] = useState(null);
  const [joined, setJoined] = useState(false);
  const [peers, setPeers] = useState({});
  const [participants, setParticipants] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);

  useEffect(() => {
    socket.on('receive_message', (data) => {
      setMessages((prev) => [...prev, data]);
    });

    socket.on('user-joined', async ({ id }) => {
      const peerConnection = createPeerConnection(id);
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      socket.emit('offer', { offer, to: id });
    });

    socket.on('offer', async ({ offer, from }) => {
      const peerConnection = createPeerConnection(from);
      await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      socket.emit('answer', { answer, to: from });
    });

    socket.on('answer', async ({ answer, from }) => {
      const peerConnection = peers[from];
      if (peerConnection) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      }
    });

    socket.on('ice-candidate', ({ candidate, from }) => {
      const peerConnection = peers[from];
      if (peerConnection) {
        peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      }
    });

    socket.on('update-participants', (list) => {
      setParticipants(list);
    });

    return () => {
      socket.off('receive_message');
      socket.off('user-joined');
      socket.off('offer');
      socket.off('answer');
      socket.off('ice-candidate');
      socket.off('update-participants');
    };
  }, [peers]);

  const createPeerConnection = (id) => {
    const peerConnection = new RTCPeerConnection();
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice-candidate', { candidate: event.candidate, to: id });
      }
    };
    peerConnection.ontrack = (event) => {
      const remoteVideo = document.createElement('video');
      remoteVideo.srcObject = event.streams[0];
      remoteVideo.autoplay = true;
      remoteVideo.playsInline = true;
      remoteVideo.className = 'video';
      document.getElementById('remote-videos').appendChild(remoteVideo);
    };
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStreamRef.current);
      });
    }
    setPeers((prev) => ({ ...prev, [id]: peerConnection }));
    return peerConnection;
  };

  const joinRoom = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localVideoRef.current.srcObject = stream;
      localStreamRef.current = stream;
      socket.emit('join-room', { roomId, userName });
      setJoined(true);
    } catch (err) {
      alert('カメラまたはマイクが見つかりません');
    }
  };

  const sendMessage = () => {
    if (!message && !file) return;

    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        socket.emit('send_message', {
          message,
          roomId,
          userName,
          file: reader.result,
          fileName: file.name,
        });
        setMessage('');
        setFile(null);
      };
      reader.readAsDataURL(file);
    } else {
      socket.emit('send_message', { message, roomId, userName });
      setMessage('');
    }
  };

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const leaveRoom = () => {
    window.location.reload();
  };

  const toggleMute = () => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getAudioTracks().forEach((track) => {
      track.enabled = !track.enabled;
    });
    setIsMuted((prev) => !prev);
  };

  const toggleVideo = () => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getVideoTracks().forEach((track) => {
      track.enabled = !track.enabled;
    });
    setIsVideoOff((prev) => !prev);
  };
  return (
    <div className="container">
      <h2 style={{ color: '#6b8e23' }}>ルームID: {roomId || '未参加'}</h2>

      {!joined && (
        <>
          <input
            type="text"
            placeholder="ユーザー名"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
          />
          <input
            type="text"
            placeholder="ルームID"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
          />
          <button onClick={joinRoom}>通話に参加</button>
        </>
      )}

      {joined && (
        <>
          <div style={{ marginTop: '20px' }}>
            <video ref={localVideoRef} autoPlay muted playsInline className="video" />
            <div id="remote-videos" className="video-container"></div>
          </div>

          <div style={{ marginTop: '10px' }}>
            <button onClick={toggleMute}>
              {isMuted ? 'ミュート解除' : 'ミュート'}
            </button>
            <button onClick={toggleVideo}>
              {isVideoOff ? 'ビデオ再開' : 'ビデオ停止'}
            </button>
            <button onClick={leaveRoom}>退出</button>
          </div>

          <div style={{ marginTop: '20px' }}>
            <input
              type="text"
              placeholder="メッセージを入力"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <input type="file" onChange={handleFileChange} />
            <button onClick={sendMessage}>送信</button>
          </div>

          <ul style={{ marginTop: '20px' }}>
            {messages
              .filter((msg) => msg.roomId === roomId)
              .map((msg, index) => (
                <li key={index}>
                  <strong>{msg.userName || '匿名'}:</strong> {msg.message}
                  {msg.file && (
                    <div>
                      {msg.file.startsWith('data:image') ? (
                        <img src={msg.file} alt={msg.fileName} style={{ maxWidth: '200px' }} />
                      ) : (
                        <video src={msg.file} controls style={{ maxWidth: '200px' }} />
                      )}
                    </div>
                  )}
                </li>
              ))}
          </ul>

          <div style={{ marginTop: '20px' }}>
            <h3>参加者一覧</h3>
            <ul>
              {participants.map((name, index) => (
                <li key={index}>{name}</li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

export default App;
