import React, { useState, useRef, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { motion } from 'framer-motion';
import { Settings, RefreshCw, Zap, Disc, Info, Play, Square } from 'lucide-react';
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

  // Sequence Automation States
  const [sequence, setSequence] = useState<string>('');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<{ gate: string; index: number; total: number } | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Demo Mode States
  const [isDemoRunning, setIsDemoRunning] = useState<boolean>(false);
  const [demoStep, setDemoStep] = useState<number>(0);
  const [demoText, setDemoText] = useState<{ title: string; description: string } | null>(null);
  const demoCancelledRef = useRef<boolean>(false);

  // Mobile UI States
  const [isMobile, setIsMobile] = useState<boolean>(window.innerWidth <= 768);
  const [activeTab, setActiveTab] = useState<'controls' | 'gates' | 'info'>('controls');

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Convenience lockout variable
  const isLocked = isRunning || isDemoRunning;

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

  // Pure mathematical helper to compute gate transitions
  const computeGateTransition = (gateName: string, currentTheta: number, currentPhi: number) => {
    let nextTheta = currentTheta;
    let nextPhi = currentPhi;
    
    if (gateName === 'X') {
      nextTheta = Math.PI - currentTheta;
      const next = -currentPhi;
      nextPhi = (next < 0 ? next + 2 * Math.PI : next) % (2 * Math.PI);
    } else if (gateName === 'Y') {
      nextTheta = Math.PI - currentTheta;
      const next = Math.PI - currentPhi;
      nextPhi = (next < 0 ? next + 2 * Math.PI : next) % (2 * Math.PI);
    } else if (gateName === 'Z') {
      nextPhi = (currentPhi + Math.PI) % (2 * Math.PI);
    } else if (gateName === 'H') {
      const x = Math.sin(currentTheta) * Math.cos(currentPhi);
      const y = Math.sin(currentTheta) * Math.sin(currentPhi);
      const z = Math.cos(currentTheta);
      
      const nx = z;
      const ny = -y;
      const nz = x;
      
      nextTheta = Math.acos(Math.max(-1, Math.min(1, nz)));
      let nPhi = Math.atan2(ny, nx);
      if (nPhi < 0) nPhi += 2 * Math.PI;
      nextPhi = nPhi;
    }
    
    return { theta: nextTheta, phi: nextPhi };
  };

  // Generic gate handler
  const applyGate = (gateName: string) => {
    if (isLocked) return;
    setBeforeTheta(theta);
    setBeforePhi(phi);
    setLastGate(gateName);
    
    const nextState = computeGateTransition(gateName, theta, phi);
    setTheta(nextState.theta);
    setPhi(nextState.phi);
  };

  // Gate actions
  const applyX = () => applyGate('X');
  const applyY = () => applyGate('Y');
  const applyZ = () => applyGate('Z');
  const applyH = () => applyGate('H');

  // Sequence automation execution
  const runSequence = async () => {
    if (isLocked) return;

    const trimmed = sequence.trim();
    if (!trimmed) {
      setValidationError("Sequence cannot be empty.");
      return;
    }

    const rawGates = trimmed.split(/\s+/);
    const validGates = ['X', 'Y', 'Z', 'H'];
    const invalid = rawGates.filter(g => !validGates.includes(g.toUpperCase()));

    if (invalid.length > 0) {
      setValidationError(`Invalid gates: ${invalid.join(', ')}. Use only X, Y, Z, H separated by spaces.`);
      return;
    }

    setValidationError(null);
    setIsRunning(true);

    let currentT = theta;
    let currentP = phi;
    const gates = rawGates.map(g => g.toUpperCase());

    for (let i = 0; i < gates.length; i++) {
      const gate = gates[i];
      
      setCurrentStep({ gate, index: i + 1, total: gates.length });
      
      setBeforeTheta(currentT);
      setBeforePhi(currentP);
      setLastGate(gate);
      
      const nextState = computeGateTransition(gate, currentT, currentP);
      
      setTheta(nextState.theta);
      setPhi(nextState.phi);
      
      currentT = nextState.theta;
      currentP = nextState.phi;

      await new Promise<void>(resolve => setTimeout(resolve, 800));
    }

    setIsRunning(false);
    setCurrentStep(null);
  };

  const clearSequence = () => {
    if (isLocked) return;
    setSequence('');
    setValidationError(null);
  };

  // ==========================================
  // DEMO MODE FUNCTIONS
  // ==========================================

  const animateValue = (from: number, to: number, durationMs: number, setter: (v: number) => void): Promise<void> => {
    return new Promise((resolve) => {
      const startTime = performance.now();
      const step = (now: number) => {
        if (demoCancelledRef.current) { resolve(); return; }
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / durationMs, 1);
        // EaseInOut cubic
        const eased = progress < 0.5
          ? 2 * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 2) / 2;
        setter(from + (to - from) * eased);
        if (progress < 1) {
          requestAnimationFrame(step);
        } else {
          resolve();
        }
      };
      requestAnimationFrame(step);
    });
  };

  const demoDelay = (ms: number): Promise<void> => {
    return new Promise((resolve) => {
      setTimeout(() => resolve(), ms);
    });
  };

  const cleanupDemo = () => {
    setIsDemoRunning(false);
    setDemoStep(0);
    setDemoText(null);
  };

  const startDemo = async () => {
    if (isLocked) return;
    demoCancelledRef.current = false;
    setIsDemoRunning(true);
    setActiveTab('info'); // Auto-switch to Info tab to show step guide on mobile

    // Reset to |0⟩
    setTheta(0);
    setPhi(0);
    setResetCounter(prev => prev + 1);
    setLastGate('None');
    setBeforeTheta(null);
    setBeforePhi(null);

    await demoDelay(500);
    if (demoCancelledRef.current) { cleanupDemo(); return; }

    // === Step 1: Superposition ===
    setDemoStep(1);
    setDemoText({
      title: 'Quantum Superposition',
      description: 'A qubit can exist in a superposition of |0⟩ and |1⟩ simultaneously. Watch as the state vector moves from the north pole (|0⟩) toward the equator, creating an equal superposition where both measurement outcomes are equally likely.'
    });
    await animateValue(0, Math.PI / 2, 3000, setTheta);
    if (demoCancelledRef.current) { cleanupDemo(); return; }
    await demoDelay(3000);
    if (demoCancelledRef.current) { cleanupDemo(); return; }

    // === Step 2: Polar Angles ===
    setDemoStep(2);
    setDemoText({
      title: 'Polar Angles (θ and φ)',
      description: 'θ (theta) controls the tilt from |0⟩ to |1⟩, determining measurement probabilities. φ (phi) controls rotation around the Z-axis, representing the quantum phase — an invisible but crucial property that affects interference patterns.'
    });
    await animateValue(0, 2 * Math.PI, 4000, setPhi);
    if (demoCancelledRef.current) { cleanupDemo(); return; }
    await demoDelay(3000);
    if (demoCancelledRef.current) { cleanupDemo(); return; }

    // === Step 3: Bloch Sphere Overview (camera auto-rotation) ===
    setDemoStep(3);
    setDemoText({
      title: 'The Bloch Sphere',
      description: 'Every possible single-qubit state maps to a unique point on this sphere. The north pole is |0⟩, the south pole is |1⟩, and the equator represents all balanced superposition states with different quantum phases.'
    });
    await demoDelay(5000);
    if (demoCancelledRef.current) { cleanupDemo(); return; }

    // === Step 4: Measurement Collapse ===
    setDemoStep(4);
    const collapseToZero = Math.random() > 0.5;
    setDemoText({
      title: 'Measurement & Collapse',
      description: `When a qubit in superposition is measured, it instantly collapses to a definite state. The probability is determined by the vector's position. Collapsing to ${collapseToZero ? '|0⟩ (north pole)' : '|1⟩ (south pole)'}...`
    });
    await demoDelay(2000);
    if (demoCancelledRef.current) { cleanupDemo(); return; }

    // Animate collapse
    if (collapseToZero) {
      await animateValue(Math.PI / 2, 0, 1000, setTheta);
      setPhi(0);
    } else {
      await animateValue(Math.PI / 2, Math.PI, 1000, setTheta);
      setPhi(0);
    }
    if (demoCancelledRef.current) { cleanupDemo(); return; }

    setDemoText({
      title: collapseToZero ? 'Collapsed to |0⟩!' : 'Collapsed to |1⟩!',
      description: collapseToZero
        ? 'The measurement yielded |0⟩. The qubit is now in a definite state at the north pole. Each measurement is inherently random — running the demo again may produce a different outcome!'
        : 'The measurement yielded |1⟩. The qubit collapsed to the south pole. This randomness is a fundamental feature of quantum mechanics, not a limitation of our instruments.'
    });
    await demoDelay(4000);

    cleanupDemo();
  };

  const stopDemo = () => {
    demoCancelledRef.current = true;
    cleanupDemo();
  };

  // ==========================================
  // RESET
  // ==========================================

  const reset = () => {
    if (isLocked) return;
    setTheta(0);
    setPhi(0);
    setResetCounter(prev => prev + 1);
    setLastGate('None');
    setBeforeTheta(null);
    setBeforePhi(null);
  };

  // Demo step labels for progress dots
  const demoStepLabels = ['Superposition', 'Polar Angles', 'Bloch Sphere', 'Measurement'];

  return (
    <div className={`app-container ${isMobile ? 'mobile-mode' : ''}`}>
      {/* 1. Title on Mobile (Rendered at top of DOM structure) */}
      {isMobile && (
        <header className="mobile-header">
          <h1>Bloch Sphere <span style={{ color: 'var(--accent-color)' }}>Visualizer</span></h1>
          <p className="header-subtitle">Interactive Quantum Qubit State Explorer</p>
        </header>
      )}

      {/* 2. 3D Bloch Sphere Canvas (Flows vertically on mobile, full-screen background on desktop) */}
      <div className="canvas-wrapper">
        <Canvas>
          <PerspectiveCamera makeDefault position={[5, 3, 5]} fov={40} />
          <OrbitControls 
            enablePan={false} 
            minDistance={4} 
            maxDistance={10}
            autoRotate={isDemoRunning && demoStep === 3}
            autoRotateSpeed={3}
          />
          <BlochSphere theta={theta} phi={phi} resetCounter={resetCounter} />
        </Canvas>
      </div>

      {/* UI Overlay */}
      <div className="ui-overlay">
        {/* Header on Desktop */}
        {!isMobile && (
          <header style={{ pointerEvents: 'auto' }}>
            <motion.div initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
              <h1>Bloch Sphere <span style={{ color: 'var(--accent-color)' }}>Visualizer</span></h1>
              <p className="header-subtitle">Interactive Quantum Qubit State Explorer</p>
            </motion.div>
          </header>
        )}

        {isMobile ? (
          /* Mobile Stacked Layout with Tabs */
          <div className="mobile-layout-content">
            {/* 3. Tab Navigation */}
            <div className="mobile-tabs-nav">
              <button 
                className={`tab-btn ${activeTab === 'controls' ? 'active' : ''}`}
                onClick={() => setActiveTab('controls')}
              >
                Controls
              </button>
              <button 
                className={`tab-btn ${activeTab === 'gates' ? 'active' : ''}`}
                onClick={() => setActiveTab('gates')}
              >
                Gates
              </button>
              <button 
                className={`tab-btn ${activeTab === 'info' ? 'active' : ''}`}
                onClick={() => setActiveTab('info')}
              >
                Info
              </button>
            </div>

            {/* 4. Tab Content */}
            <div className="mobile-tab-content">
              {activeTab === 'controls' && (
                <div className="glass-panel mobile-tab-panel">
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
                      disabled={isLocked}
                      style={{
                        opacity: isLocked ? 0.5 : 1,
                        pointerEvents: isLocked ? 'none' : 'auto'
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
                      disabled={isLocked}
                      style={{
                        opacity: isLocked ? 0.5 : 1,
                        pointerEvents: isLocked ? 'none' : 'auto'
                      }}
                    />
                  </div>

                  {/* Presets */}
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '15px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                      <Disc size={18} color="var(--accent-color)" />
                      <h3 style={{ fontSize: '1rem', margin: 0 }}>Presets</h3>
                    </div>
                    <div className="buttons-grid">
                      <button className="neon-button secondary" onClick={() => { if (!isLocked) { setTheta(0); setPhi(0); setLastGate('None'); setBeforeTheta(null); setBeforePhi(null); } }} disabled={isLocked} style={{ opacity: isLocked ? 0.4 : 1, pointerEvents: isLocked ? 'none' : 'auto' }}>|0⟩</button>
                      <button className="neon-button secondary" onClick={() => { if (!isLocked) { setTheta(Math.PI); setPhi(0); setLastGate('None'); setBeforeTheta(null); setBeforePhi(null); } }} disabled={isLocked} style={{ opacity: isLocked ? 0.4 : 1, pointerEvents: isLocked ? 'none' : 'auto' }}>|1⟩</button>
                      <button className="neon-button secondary" onClick={() => { if (!isLocked) { setTheta(Math.PI/2); setPhi(0); setLastGate('None'); setBeforeTheta(null); setBeforePhi(null); } }} disabled={isLocked} style={{ opacity: isLocked ? 0.4 : 1, pointerEvents: isLocked ? 'none' : 'auto' }}>|+⟩</button>
                      <button className="neon-button secondary" onClick={() => { if (!isLocked) { setTheta(Math.PI/2); setPhi(Math.PI); setLastGate('None'); setBeforeTheta(null); setBeforePhi(null); } }} disabled={isLocked} style={{ opacity: isLocked ? 0.4 : 1, pointerEvents: isLocked ? 'none' : 'auto' }}>|-⟩</button>
                    </div>
                    <button className="neon-button" style={{ width: '100%', marginTop: '10px', borderColor: '#ff4444', color: '#ff4444', opacity: isLocked ? 0.4 : 1, pointerEvents: isLocked ? 'none' : 'auto' }} onClick={reset} disabled={isLocked}>
                      <RefreshCw size={14} style={{ marginRight: '5px' }} /> Reset
                    </button>
                  </div>

                  {/* Demo Mode */}
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '15px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                      <Play size={18} color="#00ff88" />
                      <h3 style={{ fontSize: '1rem', margin: 0 }}>Demo Mode</h3>
                    </div>
                    {isDemoRunning ? (
                      <button 
                        className="neon-button demo-stop-btn"
                        onClick={stopDemo}
                        style={{ width: '100%' }}
                      >
                        <Square size={14} style={{ marginRight: '6px' }} /> Stop Demo
                      </button>
                    ) : (
                      <button 
                        className="neon-button demo-start-btn"
                        onClick={startDemo}
                        disabled={isRunning}
                        style={{ width: '100%', opacity: isRunning ? 0.4 : 1 }}
                      >
                        <Play size={14} style={{ marginRight: '6px' }} /> Start Demo
                      </button>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'gates' && (
                <div className="glass-panel mobile-tab-panel">
                  {/* Quantum Gates */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                      <Zap size={18} color="var(--accent-color)" />
                      <h3 style={{ fontSize: '1rem', margin: 0 }}>Quantum Gates</h3>
                    </div>
                    <div className="buttons-grid">
                      <button className="neon-button" onClick={applyX} disabled={isLocked} style={{ opacity: isLocked ? 0.4 : 1, pointerEvents: isLocked ? 'none' : 'auto' }}>X Gate</button>
                      <button className="neon-button" onClick={applyY} disabled={isLocked} style={{ opacity: isLocked ? 0.4 : 1, pointerEvents: isLocked ? 'none' : 'auto' }}>Y Gate</button>
                      <button className="neon-button" onClick={applyZ} disabled={isLocked} style={{ opacity: isLocked ? 0.4 : 1, pointerEvents: isLocked ? 'none' : 'auto' }}>Z Gate</button>
                      <button className="neon-button" onClick={applyH} disabled={isLocked} style={{ opacity: isLocked ? 0.4 : 1, pointerEvents: isLocked ? 'none' : 'auto' }}>Hadamard</button>
                    </div>
                  </div>

                  {/* Gate Sequence Automation */}
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '15px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                      <Settings size={18} color="var(--accent-color)" />
                      <h3 style={{ fontSize: '1rem', margin: 0 }}>Gate Sequence</h3>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <input
                        type="text"
                        placeholder="e.g. H X Z Y"
                        value={sequence}
                        onChange={(e) => {
                          setSequence(e.target.value);
                          setValidationError(null);
                        }}
                        disabled={isLocked}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          background: 'rgba(0,0,0,0.5)',
                          border: '1px solid rgba(255,255,255,0.2)',
                          color: '#fff',
                          fontFamily: 'monospace',
                          fontSize: '0.9rem',
                          outline: 'none',
                          opacity: isLocked ? 0.6 : 1
                        }}
                      />
                      
                      {validationError && (
                        <div style={{ color: '#ff4444', fontSize: '0.75rem', lineHeight: '1.4' }}>
                          {validationError}
                        </div>
                      )}
                      
                      {currentStep && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--accent-color)', fontWeight: 600 }}>
                          <RefreshCw size={12} className="animate-spin" />
                          Running: {currentStep.gate} → Step {currentStep.index}/{currentStep.total}
                        </div>
                      )}

                      <div className="buttons-grid">
                        <button 
                          className="neon-button" 
                          onClick={runSequence}
                          disabled={isLocked}
                          style={{ opacity: isLocked ? 0.5 : 1, pointerEvents: isLocked ? 'none' : 'auto' }}
                        >
                          Run
                        </button>
                        <button 
                          className="neon-button secondary" 
                          onClick={clearSequence}
                          disabled={isLocked}
                          style={{ opacity: isLocked ? 0.5 : 1, pointerEvents: isLocked ? 'none' : 'auto' }}
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'info' && (
                <div className="glass-panel mobile-tab-panel">
                  {/* Educational / Demo Content */}
                  <div>
                    {isDemoRunning && demoText ? (
                      <>
                        <div className="demo-active-badge" style={{ marginBottom: '12px' }}>
                          <div className="demo-pulse-dot" />
                          <span>Demo Mode Active</span>
                        </div>

                        <div className="demo-step-dots">
                          {demoStepLabels.map((label, i) => (
                            <div key={i} className="demo-step-dot-group">
                              <div 
                                className={`demo-dot ${i + 1 === demoStep ? 'active' : ''} ${i + 1 < demoStep ? 'completed' : ''}`}
                              />
                              <span className={`demo-dot-label ${i + 1 === demoStep ? 'active' : ''}`}>
                                {label}
                              </span>
                            </div>
                          ))}
                        </div>

                        <div className="demo-step-content" style={{ margin: '12px 0' }}>
                          <h3 style={{ fontSize: '1rem', marginBottom: '8px', lineHeight: '1.3' }}>
                            Step {demoStep}: {demoText.title}
                          </h3>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                            {demoText.description}
                          </p>
                        </div>

                        <div className="demo-live-values">
                          <div className="demo-live-row">
                            <span>θ</span>
                            <span>{formatNum(theta)} rad ({(theta / Math.PI * 180).toFixed(0)}°)</span>
                          </div>
                          <div className="demo-live-row">
                            <span>φ</span>
                            <span>{formatNum(phi)} rad ({(phi / Math.PI * 180).toFixed(0)}°)</span>
                          </div>
                          <div className="demo-live-row">
                            <span>P(|0⟩)</span>
                            <span>{(p0 * 100).toFixed(1)}%</span>
                          </div>
                          <div className="demo-live-row">
                            <span>P(|1⟩)</span>
                            <span>{(p1 * 100).toFixed(1)}%</span>
                          </div>
                        </div>

                        {/* Mobile Demo Stop Button */}
                        <div style={{ marginTop: '15px' }}>
                          <button 
                            className="neon-button demo-stop-btn"
                            onClick={stopDemo}
                            style={{ width: '100%' }}
                          >
                            <Square size={14} style={{ marginRight: '6px' }} /> Stop Demo
                          </button>
                        </div>
                      </>
                    ) : lastGate === 'None' ? (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                          <Info size={18} color="var(--accent-color)" />
                          <h3 style={{ fontSize: '1rem', margin: 0 }}>Educational Guide</h3>
                        </div>
                        
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.5', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <p>
                            A single qubit state <span style={{ color: 'var(--text-primary)' }}>|ψ⟩</span> is represented geometrically as a point on the surface of a 3D unit sphere called the <strong>Bloch Sphere</strong>.
                          </p>
                          <p>
                            • The top pole represents <span className="label-0">|0⟩</span> (ground state).
                          </p>
                          <p>
                            • The bottom pole represents <span className="label-1">|1⟩</span> (excited state).
                          </p>
                          <p>
                            • Any point on the equator represents a balanced superposition state, such as <span style={{ color: 'var(--accent-color)' }}>|+⟩</span> and <span style={{ color: 'var(--secondary-accent)' }}>|-⟩</span>.
                          </p>
                          <p style={{ marginTop: '5px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '10px' }}>
                            Use the sliders or apply <strong>Quantum Gates</strong> to see the state vector transition and trace its path across the sphere!
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                          <Zap size={18} color="var(--accent-color)" />
                          <h3 style={{ fontSize: '1rem', margin: 0 }}>Applied Gate: {lastGate}</h3>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <div style={{ fontSize: '0.8rem' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Rotation Axis:</span>{' '}
                            <strong style={{ color: 'var(--accent-color)' }}>
                              {lastGate === 'X' && 'X Axis (horizontal)'}
                              {lastGate === 'Y' && 'Y Axis (depth)'}
                              {lastGate === 'Z' && 'Z Axis (vertical)'}
                              {lastGate === 'H' && 'Rotation around normalized axis (X + Z)/√2'}
                            </strong>
                          </div>

                          <div style={{ fontSize: '0.8rem' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Rotation Angle:</span>{' '}
                            <strong style={{ color: 'var(--accent-color)' }}>180°</strong>
                          </div>

                          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '10px 0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                              <span style={{ color: 'var(--text-secondary)' }}>Before:</span><br />
                              |ψ_in⟩ = {beforeTheta !== null && beforePhi !== null ? formatState(beforeTheta, beforePhi) : 'None'}
                            </div>
                            <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                              <span style={{ color: 'var(--text-secondary)' }}>After:</span><br />
                              |ψ_out⟩ = {formatState(theta, phi)}
                            </div>
                          </div>

                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.4', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {lastGate === 'X' && (
                              <p>
                                The <strong>X Gate</strong> rotates the vector by 180° around the X-axis, swapping <span className="label-0">|0⟩</span> ↔ <span className="label-1">|1⟩</span>.
                              </p>
                            )}
                            {lastGate === 'Y' && (
                              <p>
                                The <strong>Y Gate</strong> rotates the vector by 180° around the Y-axis, flipping states and introducing a relative complex phase.
                              </p>
                            )}
                            {lastGate === 'Z' && (
                              <p>
                                The <strong>Z Gate</strong> rotates the vector by 180° around the Z-axis, shifting the phase of <span className="label-1">|1⟩</span> by π.
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
                  </div>

                  {/* Quantum State Vector Display (Bottom of Info tab) */}
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '15px', marginTop: '5px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                      <Info size={16} color="var(--accent-color)" />
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Quantum State Vector |ψ⟩</span>
                    </div>
                    <div style={{ fontSize: '0.85rem', fontFamily: 'monospace', wordBreak: 'break-all', marginBottom: '12px', background: 'rgba(0,0,0,0.3)', padding: '8px', borderRadius: '6px' }}>
                      |ψ⟩ = {formatNum(Math.cos(theta/2))} |0⟩ + ({formatNum(Math.cos(phi) * Math.sin(theta/2))} + {formatNum(Math.sin(phi) * Math.sin(theta/2))}i) |1⟩
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                        <span>P(|0⟩): {(p0 * 100).toFixed(1)}%</span>
                        <span>P(|1⟩): {(p1 * 100).toFixed(1)}%</span>
                      </div>
                      <div style={{ height: '6px', background: '#333', borderRadius: '3px', display: 'flex', overflow: 'hidden' }}>
                        <div style={{ width: `${p0 * 100}%`, background: 'var(--accent-color)', transition: 'width 0.3s ease' }}></div>
                        <div style={{ width: `${p1 * 100}%`, background: 'var(--secondary-accent)', transition: 'width 0.3s ease' }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Desktop Layout - 100% Unchanged */
          <>
            <div className="panels-row">
              {/* Controls Panel (Left) */}
              <motion.div 
                initial={{ x: -100, opacity: 0 }} 
                animate={{ x: 0, opacity: 1 }}
                className="glass-panel panel-left"
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
                    disabled={isLocked}
                    style={{
                      opacity: isLocked ? 0.5 : 1,
                      pointerEvents: isLocked ? 'none' : 'auto'
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
                    disabled={isLocked}
                    style={{
                      opacity: isLocked ? 0.5 : 1,
                      pointerEvents: isLocked ? 'none' : 'auto'
                    }}
                  />
                </div>

                <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '15px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                    <Zap size={18} color="var(--accent-color)" />
                    <h3 style={{ fontSize: '1rem', margin: 0 }}>Quantum Gates</h3>
                  </div>
                  <div className="buttons-grid">
                    <button className="neon-button" onClick={applyX} disabled={isLocked} style={{ opacity: isLocked ? 0.4 : 1, pointerEvents: isLocked ? 'none' : 'auto' }}>X Gate</button>
                    <button className="neon-button" onClick={applyY} disabled={isLocked} style={{ opacity: isLocked ? 0.4 : 1, pointerEvents: isLocked ? 'none' : 'auto' }}>Y Gate</button>
                    <button className="neon-button" onClick={applyZ} disabled={isLocked} style={{ opacity: isLocked ? 0.4 : 1, pointerEvents: isLocked ? 'none' : 'auto' }}>Z Gate</button>
                    <button className="neon-button" onClick={applyH} disabled={isLocked} style={{ opacity: isLocked ? 0.4 : 1, pointerEvents: isLocked ? 'none' : 'auto' }}>Hadamard</button>
                  </div>
                </div>

                {/* Gate Sequence Automation Section */}
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '15px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                    <Settings size={18} color="var(--accent-color)" />
                    <h3 style={{ fontSize: '1rem', margin: 0 }}>Gate Sequence</h3>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <input
                      type="text"
                      placeholder="e.g. H X Z Y"
                      value={sequence}
                      onChange={(e) => {
                        setSequence(e.target.value);
                        setValidationError(null);
                      }}
                      disabled={isLocked}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        background: 'rgba(0,0,0,0.5)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        color: '#fff',
                        fontFamily: 'monospace',
                        fontSize: '0.9rem',
                        outline: 'none',
                        opacity: isLocked ? 0.6 : 1
                      }}
                    />
                    
                    {validationError && (
                      <div style={{ color: '#ff4444', fontSize: '0.75rem', lineHeight: '1.4' }}>
                        {validationError}
                      </div>
                    )}
                    
                    {currentStep && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--accent-color)', fontWeight: 600 }}>
                        <RefreshCw size={12} className="animate-spin" />
                        Running: {currentStep.gate} → Step {currentStep.index}/{currentStep.total}
                      </div>
                    )}

                    <div className="buttons-grid">
                      <button 
                        className="neon-button" 
                        onClick={runSequence}
                        disabled={isLocked}
                        style={{ opacity: isLocked ? 0.5 : 1, pointerEvents: isLocked ? 'none' : 'auto' }}
                      >
                        Run
                      </button>
                      <button 
                        className="neon-button secondary" 
                        onClick={clearSequence}
                        disabled={isLocked}
                        style={{ opacity: isLocked ? 0.5 : 1, pointerEvents: isLocked ? 'none' : 'auto' }}
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                </div>

                {/* Demo Mode Section */}
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '15px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                    <Play size={18} color="#00ff88" />
                    <h3 style={{ fontSize: '1rem', margin: 0 }}>Demo Mode</h3>
                  </div>
                  {isDemoRunning ? (
                    <button 
                      className="neon-button demo-stop-btn"
                      onClick={stopDemo}
                      style={{ width: '100%' }}
                    >
                      <Square size={14} style={{ marginRight: '6px' }} /> Stop Demo
                    </button>
                  ) : (
                    <button 
                      className="neon-button demo-start-btn"
                      onClick={startDemo}
                      disabled={isRunning}
                      style={{ width: '100%', opacity: isRunning ? 0.4 : 1 }}
                    >
                      <Play size={14} style={{ marginRight: '6px' }} /> Start Demo
                    </button>
                  )}
                </div>

                <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '15px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                    <Disc size={18} color="var(--accent-color)" />
                    <h3 style={{ fontSize: '1rem', margin: 0 }}>Presets</h3>
                  </div>
                  <div className="buttons-grid">
                    <button className="neon-button secondary" onClick={() => { if (!isLocked) { setTheta(0); setPhi(0); setLastGate('None'); setBeforeTheta(null); setBeforePhi(null); } }} disabled={isLocked} style={{ opacity: isLocked ? 0.4 : 1, pointerEvents: isLocked ? 'none' : 'auto' }}>|0⟩</button>
                    <button className="neon-button secondary" onClick={() => { if (!isLocked) { setTheta(Math.PI); setPhi(0); setLastGate('None'); setBeforeTheta(null); setBeforePhi(null); } }} disabled={isLocked} style={{ opacity: isLocked ? 0.4 : 1, pointerEvents: isLocked ? 'none' : 'auto' }}>|1⟩</button>
                    <button className="neon-button secondary" onClick={() => { if (!isLocked) { setTheta(Math.PI/2); setPhi(0); setLastGate('None'); setBeforeTheta(null); setBeforePhi(null); } }} disabled={isLocked} style={{ opacity: isLocked ? 0.4 : 1, pointerEvents: isLocked ? 'none' : 'auto' }}>|+⟩</button>
                    <button className="neon-button secondary" onClick={() => { if (!isLocked) { setTheta(Math.PI/2); setPhi(Math.PI); setLastGate('None'); setBeforeTheta(null); setBeforePhi(null); } }} disabled={isLocked} style={{ opacity: isLocked ? 0.4 : 1, pointerEvents: isLocked ? 'none' : 'auto' }}>|-⟩</button>
                  </div>
                  <button className="neon-button" style={{ width: '100%', marginTop: '10px', borderColor: '#ff4444', color: '#ff4444', opacity: isLocked ? 0.4 : 1, pointerEvents: isLocked ? 'none' : 'auto' }} onClick={reset} disabled={isLocked}>
                    <RefreshCw size={14} style={{ marginRight: '5px' }} /> Reset
                  </button>
                </div>
              </motion.div>

              {/* Educational / Demo Panel (Right) */}
              <motion.div 
                initial={{ x: 100, opacity: 0 }} 
                animate={{ x: 0, opacity: 1 }}
                className="glass-panel panel-right"
              >
                {isDemoRunning && demoText ? (
                  <>
                    <div className="demo-active-badge">
                      <div className="demo-pulse-dot" />
                      <span>Demo Mode Active</span>
                    </div>

                    <div className="demo-step-dots">
                      {demoStepLabels.map((label, i) => (
                        <div key={i} className="demo-step-dot-group">
                          <div 
                            className={`demo-dot ${i + 1 === demoStep ? 'active' : ''} ${i + 1 < demoStep ? 'completed' : ''}`}
                          />
                          <span className={`demo-dot-label ${i + 1 === demoStep ? 'active' : ''}`}>
                            {label}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="demo-step-content">
                      <h3 style={{ fontSize: '1.1rem', marginBottom: '12px', lineHeight: '1.3' }}>
                        Step {demoStep}: {demoText.title}
                      </h3>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.7' }}>
                        {demoText.description}
                      </p>
                    </div>

                    <div className="demo-live-values">
                      <div className="demo-live-row">
                        <span>θ</span>
                        <span>{formatNum(theta)} rad ({(theta / Math.PI * 180).toFixed(0)}°)</span>
                      </div>
                      <div className="demo-live-row">
                        <span>φ</span>
                        <span>{formatNum(phi)} rad ({(phi / Math.PI * 180).toFixed(0)}°)</span>
                      </div>
                      <div className="demo-live-row">
                        <span>P(|0⟩)</span>
                        <span>{(p0 * 100).toFixed(1)}%</span>
                      </div>
                      <div className="demo-live-row">
                        <span>P(|1⟩)</span>
                        <span>{(p1 * 100).toFixed(1)}%</span>
                      </div>
                    </div>
                  </>
                ) : lastGate === 'None' ? (
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
                className="glass-panel footer-content"
              >
                <div className="footer-state-info">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Info size={16} color="var(--accent-color)" />
                    <span className="footer-state-label">Quantum State Vector |ψ⟩</span>
                  </div>
                  <div className="state-formula">
                    |ψ⟩ = {formatNum(Math.cos(theta/2))} |0⟩ + ({formatNum(Math.cos(phi) * Math.sin(theta/2))} + {formatNum(Math.sin(phi) * Math.sin(theta/2))}i) |1⟩
                  </div>
                </div>

                <div className="footer-probabilities">
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
          </>
        )}
      </div>
    </div>
  );
};

export default App;
