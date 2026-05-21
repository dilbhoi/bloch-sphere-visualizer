import React, { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { motion } from 'framer-motion';
import { Settings, RefreshCw, Zap, Disc, Info } from 'lucide-react';
import BlochSphere from './components/BlochSphere';
import './index.css';

const App: React.FC = () => {
  const [theta, setTheta] = useState(0); // 0 to PI
  const [phi, setPhi] = useState(0); // 0 to 2PI
  const [resetCounter, setResetCounter] = useState(0);

  // Educational States
  const [lastGate, setLastGate] = useState<string>('None');
  const [beforeTheta, setBeforeTheta] = useState<number | null>(null);
  const [beforePhi, setBeforePhi] = useState<number | null>(null);

  // Calculate probabilities
  const p0 = Math.pow(Math.cos(theta / 2), 2);
  const p1 = Math.pow(Math.sin(theta / 2), 2);

  // Formatting helpers
  const formatNum = (n: number) => n.toFixed(3);

  const formatState = (t: number, p: number) => {
    const cosVal = Math.cos(t / 2);
    const sinVal = Math.sin(t / 2);
    const r = Math.cos(p) * sinVal;
    const i = Math.sin(p) * sinVal;
    
    const rSign = i >= 0 ? '+' : '-';
    const absI = Math.abs(i);
    
    return `${cosVal.toFixed(3)}|0⟩ ${r >= 0 ? '+' : '-'} (${Math.abs(r).toFixed(3)} ${rSign} ${absI.toFixed(3)}i)|1⟩`;
  };

  // Gate actions
  const applyX = () => {
    setBeforeTheta(theta);
    setBeforePhi(phi);
    setLastGate('X');
    setTheta(prev => Math.PI - prev);
    setPhi(prev => {
      const next = -prev;
      return (next < 0 ? next + 2 * Math.PI : next) % (2 * Math.PI);
    });
  };

  const applyY = () => {
    setBeforeTheta(theta);
    setBeforePhi(phi);
    setLastGate('Y');
    setTheta(prev => Math.PI - prev);
    setPhi(prev => {
      const next = Math.PI - prev;
      return (next < 0 ? next + 2 * Math.PI : next) % (2 * Math.PI);
    });
  };

  const applyZ = () => {
    setBeforeTheta(theta);
    setBeforePhi(phi);
    setLastGate('Z');
    setPhi(prev => (prev + Math.PI) % (2 * Math.PI));
  };

  const applyH = () => {
    setBeforeTheta(theta);
    setBeforePhi(phi);
    setLastGate('H');
    // Convert to cartesian
    const x = Math.sin(theta) * Math.cos(phi);
    const y = Math.sin(theta) * Math.sin(phi);
    const z = Math.cos(theta);
    
    // H gate: (x, y, z) -> (z, -y, x)
    const nx = z;
    const ny = -y;
    const nz = x;
    
    // Convert back to spherical
    const nTheta = Math.acos(Math.max(-1, Math.min(1, nz)));
    let nPhi = Math.atan2(ny, nx);
    if (nPhi < 0) nPhi += 2 * Math.PI;
    
    setTheta(nTheta);
    setPhi(nPhi);
  };

  const reset = () => {
    setTheta(0);
    setPhi(0);
    setResetCounter(prev => prev + 1);
    setLastGate('None');
    setBeforeTheta(null);
    setBeforePhi(null);
  };

  return (
    <div className="app-container" style={{ height: '100vh', width: '100vw', position: 'relative' }}>
      {/* 3D Background */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }}>
        <Canvas>
          <PerspectiveCamera makeDefault position={[5, 3, 5]} fov={40} />
          <OrbitControls enablePan={false} minDistance={4} maxDistance={10} />
          <color attach="background" args={['#050505']} />
          <BlochSphere theta={theta} phi={phi} resetCounter={resetCounter} />
        </Canvas>
      </div>

      {/* UI Overlay */}
      <div style={{ position: 'relative', zIndex: 1, pointerEvents: 'none', height: '100%', padding: '30px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        
        {/* Header */}
        <header style={{ pointerEvents: 'auto' }}>
          <motion.div initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
            <h1>Bloch Sphere <span style={{ color: 'var(--accent-color)' }}>Visualizer</span></h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Interactive Quantum Qubit State Explorer</p>
          </motion.div>
        </header>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', flex: 1, alignItems: 'center' }}>
          {/* Controls Panel (Left) */}
          <motion.div 
            initial={{ x: -100, opacity: 0 }} 
            animate={{ x: 0, opacity: 1 }}
            className="glass-panel" 
            style={{ pointerEvents: 'auto', width: '300px', display: 'flex', flexDirection: 'column', gap: '20px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Settings size={18} color="var(--accent-color)" />
              <h3 style={{ fontSize: '1rem', margin: 0 }}>Coordinates</h3>
            </div>

            <div className="control-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.8rem' }}>Theta (θ): {formatNum(theta)} rad</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{(theta / Math.PI * 180).toFixed(0)}°</span>
              </div>
              <input 
                type="range" min="0" max={Math.PI} step="0.01" 
                value={theta} onChange={(e) => {
                  setTheta(parseFloat(e.target.value));
                  setLastGate('None');
                  setBeforeTheta(null);
                  setBeforePhi(null);
                }} 
              />
            </div>

            <div className="control-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.8rem' }}>Phi (φ): {formatNum(phi)} rad</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{(phi / Math.PI * 180).toFixed(0)}°</span>
              </div>
              <input 
                type="range" min="0" max={2 * Math.PI} step="0.01" 
                value={phi} onChange={(e) => {
                  setPhi(parseFloat(e.target.value));
                  setLastGate('None');
                  setBeforeTheta(null);
                  setBeforePhi(null);
                }} 
              />
            </div>

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                <Zap size={18} color="var(--accent-color)" />
                <h3 style={{ fontSize: '1rem', margin: 0 }}>Quantum Gates</h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <button className="neon-button" onClick={applyX}>X Gate</button>
                <button className="neon-button" onClick={applyY}>Y Gate</button>
                <button className="neon-button" onClick={applyZ}>Z Gate</button>
                <button className="neon-button" onClick={applyH}>Hadamard</button>
              </div>
            </div>

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                <Disc size={18} color="var(--accent-color)" />
                <h3 style={{ fontSize: '1rem', margin: 0 }}>Presets</h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <button className="neon-button secondary" onClick={() => { setTheta(0); setPhi(0); setLastGate('None'); setBeforeTheta(null); setBeforePhi(null); }}>|0⟩</button>
                <button className="neon-button secondary" onClick={() => { setTheta(Math.PI); setPhi(0); setLastGate('None'); setBeforeTheta(null); setBeforePhi(null); }}>|1⟩</button>
                <button className="neon-button secondary" onClick={() => { setTheta(Math.PI/2); setPhi(0); setLastGate('None'); setBeforeTheta(null); setBeforePhi(null); }}>|+⟩</button>
                <button className="neon-button secondary" onClick={() => { setTheta(Math.PI/2); setPhi(Math.PI); setLastGate('None'); setBeforeTheta(null); setBeforePhi(null); }}>|-⟩</button>
              </div>
              <button className="neon-button" style={{ width: '100%', marginTop: '10px', borderColor: '#ff4444', color: '#ff4444' }} onClick={reset}>
                <RefreshCw size={14} style={{ marginRight: '5px' }} /> Reset
              </button>
            </div>
          </motion.div>

          {/* Educational Panel (Right) */}
          <motion.div 
            initial={{ x: 100, opacity: 0 }} 
            animate={{ x: 0, opacity: 1 }}
            className="glass-panel" 
            style={{ 
              pointerEvents: 'auto', 
              width: '350px', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '20px',
              maxHeight: '75vh',
              overflowY: 'auto'
            }}
          >
            {lastGate === 'None' ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Info size={18} color="var(--accent-color)" />
                  <h3 style={{ fontSize: '1rem', margin: 0 }}>Educational Guide</h3>
                </div>
                
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.6', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <p>
                    A single qubit state <span style={{ color: 'var(--text-primary)' }}>|ψ⟩</span> is represented geometrically as a point on the surface of a 3D unit sphere called the <strong>Bloch Sphere</strong>.
                  </p>
                  <p>
                    • The top pole represents the basis state <span className="label-0">|0⟩</span> (ground state).
                  </p>
                  <p>
                    • The bottom pole represents the basis state <span className="label-1">|1⟩</span> (excited state).
                  </p>
                  <p>
                    • Any point on the equator represents a balanced superposition state, such as <span style={{ color: 'var(--accent-color)' }}>|+⟩</span> and <span style={{ color: 'var(--secondary-accent)' }}>|-⟩</span>.
                  </p>
                  <p style={{ marginTop: '5px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '12px' }}>
                    Use the sliders on the left or apply <strong>Quantum Gates</strong> to see how the state vector transitions and traces its path across the sphere!
                  </p>
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Zap size={18} color="var(--accent-color)" />
                  <h3 style={{ fontSize: '1rem', margin: 0 }}>Applied Gate: {lastGate}</h3>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Rotation Axis:</span>{' '}
                    <strong style={{ color: 'var(--accent-color)' }}>
                      {lastGate === 'X' && 'X Axis (horizontal)'}
                      {lastGate === 'Y' && 'Y Axis (depth)'}
                      {lastGate === 'Z' && 'Z Axis (vertical)'}
                      {lastGate === 'H' && 'Rotation around normalized axis (X + Z)/√2'}
                    </strong>
                  </div>

                  <div style={{ fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Rotation Angle:</span>{' '}
                    <strong style={{ color: 'var(--accent-color)' }}>180°</strong>
                  </div>

                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '12px 0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ fontSize: '0.8rem', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Before:</span><br />
                      |ψ_in⟩ = {beforeTheta !== null && beforePhi !== null ? formatState(beforeTheta, beforePhi) : 'None'}
                    </div>
                    <div style={{ fontSize: '0.8rem', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>After:</span><br />
                      |ψ_out⟩ = {formatState(theta, phi)}
                    </div>
                  </div>

                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {lastGate === 'X' && (
                      <p>
                        The <strong>X Gate</strong> acts as a classical bit-flip. It rotates the vector by 180° around the X-axis, swapping <span className="label-0">|0⟩</span> ↔ <span className="label-1">|1⟩</span> and flipping their probabilities of measurement.
                      </p>
                    )}
                    {lastGate === 'Y' && (
                      <p>
                        The <strong>Y Gate</strong> rotates the vector by 180° around the Y-axis. It flips the state and introduces a complex phase relative phase mapping $|0\rangle \to i|1\rangle$ and $|1\rangle \to -i|0\rangle$.
                      </p>
                    )}
                    {lastGate === 'Z' && (
                      <p>
                        The <strong>Z Gate</strong> acts as a phase-flip. It rotates the vector by 180° around the Z-axis, shifting the phase of the <span className="label-1">|1⟩</span> state by π while keeping <span className="label-0">|0⟩</span> unchanged.
                      </p>
                    )}
                    {lastGate === 'H' && (
                      <p>
                        The Hadamard (H) gate rotates the qubit state by 180° around the axis (X + Z)/√2 on the Bloch sphere, transforming basis states into superposition states.
                      </p>
                    )}
                  </div>
                </div>
              </>
            )}
          </motion.div>
        </div>

        {/* State Panel (Bottom) */}
        <footer style={{ pointerEvents: 'none' }}>
          <motion.div 
            initial={{ y: 50, opacity: 0 }} 
            animate={{ y: 0, opacity: 1 }}
            className="glass-panel" 
            style={{ pointerEvents: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Info size={16} color="var(--accent-color)" />
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Quantum State Vector |ψ⟩</span>
              </div>
              <div style={{ fontSize: '1.2rem', fontFamily: 'monospace', letterSpacing: '1px' }}>
                |ψ⟩ = {formatNum(Math.cos(theta/2))} |0⟩ + ({formatNum(Math.cos(phi) * Math.sin(theta/2))} + {formatNum(Math.sin(phi) * Math.sin(theta/2))}i) |1⟩
              </div>
            </div>

            <div style={{ width: '300px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                  <span>Probability P(|0⟩): {(p0 * 100).toFixed(1)}%</span>
                  <span>P(|1⟩): {(p1 * 100).toFixed(1)}%</span>
               </div>
               <div style={{ height: '8px', background: '#333', borderRadius: '4px', display: 'flex', overflow: 'hidden' }}>
                  <div style={{ width: `${p0 * 100}%`, background: 'var(--accent-color)', transition: 'width 0.3s ease' }}></div>
                  <div style={{ width: `${p1 * 100}%`, background: 'var(--secondary-accent)', transition: 'width 0.3s ease' }}></div>
               </div>
            </div>
          </motion.div>
        </footer>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .app-container {
          background-color: #050505;
        }
        .control-group {
          margin-bottom: 10px;
        }
      `}} />
    </div>
  );
};

export default App;
