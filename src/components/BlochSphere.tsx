import React, { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sphere, Line, Html } from '@react-three/drei';
import * as THREE from 'three';

interface BlochSphereProps {
  theta: number;
  phi: number;
  resetCounter: number;
}

const BlochSphere: React.FC<BlochSphereProps> = ({ theta, phi, resetCounter }) => {
  const vectorRef = useRef<THREE.Group>(null);
  const [trail, setTrail] = useState<THREE.Vector3[]>([]);

  // Reset trail on reset button click
  useEffect(() => {
    setTrail([]);
  }, [resetCounter]);
  
  // Calculate vector position
  const vectorPosition = useMemo(() => {
    const x = Math.sin(theta) * Math.cos(phi);
    const y = Math.cos(theta); // Z in traditional physics is Y in Three.js default up
    const z = -Math.sin(theta) * Math.sin(phi); // Adjust for Three.js coordinate system
    return new THREE.Vector3(x, y, z).multiplyScalar(2);
  }, [theta, phi]);

  // Smoothly rotate vector to position and update trajectory trail
  useFrame(() => {
    if (vectorRef.current) {
        const targetQuaternion = new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            vectorPosition.clone().normalize()
        );
        vectorRef.current.quaternion.slerp(targetQuaternion, 0.1);

        // Get current tip of the state vector
        const currentTip = new THREE.Vector3(0, 2, 0).applyQuaternion(vectorRef.current.quaternion);

        // Update trail if vector has moved
        setTrail(prev => {
          if (prev.length > 0) {
            const last = prev[prev.length - 1];
            if (last.distanceTo(currentTip) < 0.02) {
              return prev;
            }
          }
          const next = [...prev, currentTip.clone()];
          if (next.length > 100) {
            next.shift();
          }
          return next;
        });
    }
  });

  return (
    <group>
      {/* Main Wireframe Sphere */}
      <Sphere args={[2, 32, 32]}>
        <meshBasicMaterial color="#333" wireframe transparent opacity={0.3} />
      </Sphere>

      {/* Main Circumferences */}
      <Line points={Array.from({ length: 65 }, (_, i) => {
        const a = (i / 64) * Math.PI * 2;
        return [Math.cos(a) * 2, 0, Math.sin(a) * 2];
      })} color="#444" lineWidth={1} />
      
      <Line points={Array.from({ length: 65 }, (_, i) => {
        const a = (i / 64) * Math.PI * 2;
        return [0, Math.cos(a) * 2, Math.sin(a) * 2];
      })} color="#444" lineWidth={1} />

      {/* Axes */}
      <group>
        {/* X Axis */}
        <Line points={[[-2.5, 0, 0], [2.5, 0, 0]]} color="#ff4444" lineWidth={2} />
        <Html position={[2.7, 0, 0]}>
          <div style={{ color: '#ff4444', fontSize: '12px', fontWeight: 'bold' }}>X</div>
        </Html>
        
        {/* Y Axis (In Three.js, Y is UP, so we'll treat Z as Y for Bloch convention or just label clearly) */}
        {/* Conventional Bloch Sphere: Z is UP. Three.js UP is Y. So we map: Z(Quantum) -> Y(Three) */}
        <Line points={[[0, 0, -2.5], [0, 0, 2.5]]} color="#44ff44" lineWidth={2} />
        <Html position={[0, 0, 2.7]}>
          <div style={{ color: '#44ff44', fontSize: '12px', fontWeight: 'bold' }}>Y</div>
        </Html>

        {/* Z Axis */}
        <Line points={[[0, -2.5, 0], [0, 2.5, 0]]} color="#4444ff" lineWidth={2} />
        <Html position={[0, 2.7, 0]}>
          <div style={{ color: '#4444ff', fontSize: '12px', fontWeight: 'bold' }}>Z (|0⟩)</div>
        </Html>
        <Html position={[0, -2.7, 0]}>
          <div style={{ color: '#4444ff', fontSize: '12px', fontWeight: 'bold' }}>|1⟩</div>
        </Html>
      </group>

      {/* Trajectory Trail */}
      {trail.length > 1 && (
        <group>
          {/* Core Line */}
          <Line
            points={trail}
            color="#00f2ff"
            lineWidth={2.5}
            transparent
            opacity={0.9}
          />
          {/* Outer Glow */}
          <Line
            points={trail}
            color="#00f2ff"
            lineWidth={7}
            transparent
            opacity={0.25}
          />
        </group>
      )}

      {/* The State Vector */}
      <group ref={vectorRef}>
        <Line points={[[0, 0, 0], [0, 2, 0]]} color="#00f2ff" lineWidth={5} />
        <mesh position={[0, 2, 0]}>
          <sphereGeometry args={[0.08, 16, 16]} />
          <meshBasicMaterial color="#00f2ff" />
        </mesh>
        
        {/* Vector Glow */}
        <Line points={[[0, 0, 0], [0, 2, 0]]} color="#00f2ff" lineWidth={15} transparent opacity={0.2} />
      </group>

      {/* Equatorial labels */}
      <Html position={[2, 0, 0]}>
        <div style={{ color: '#fff', fontSize: '10px' }}>|+⟩</div>
      </Html>
      <Html position={[-2, 0, 0]}>
        <div style={{ color: '#fff', fontSize: '10px' }}>|-⟩</div>
      </Html>

      {/* Ambient Light for better visibility */}
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} />
    </group>
  );
};

export default BlochSphere;
