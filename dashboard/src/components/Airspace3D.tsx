import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Stars, Float, Text, Trail, Grid, Sky, Line } from '@react-three/drei';
import * as THREE from 'three';

interface Taxi {
  id: string;
  latitude: number;
  longitude: number;
  altitude: number;
  speed: number;
  status: string;
  risk: number;
}

interface Airspace3DProps {
  taxis: Taxi[];
}

function getPos(taxi: Taxi): [number, number, number] {
  return [
    (taxi.longitude - 78.5) * 1000,
    taxi.altitude / 10,
    (taxi.latitude - 17.5) * 1000
  ];
}

function DistanceLines({ taxis }: { taxis: Taxi[] }) {
  const lines = useMemo(() => {
    const res = [];
    for (let i = 0; i < taxis.length; i++) {
      for (let j = i + 1; j < taxis.length; j++) {
        const p1 = getPos(taxis[i]);
        const p2 = getPos(taxis[j]);
        const dist = Math.sqrt(
          Math.pow(p1[0] - p2[0], 2) +
          Math.pow(p1[1] - p2[1], 2) +
          Math.pow(p1[2] - p2[2], 2)
        );

        if (dist < 150) { // Only show lines for nearby vehicles
          res.push({
            id: `${taxis[i].id}-${taxis[j].id}`,
            points: [new THREE.Vector3(...p1), new THREE.Vector3(...p2)],
            distance: dist.toFixed(1),
            center: [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2 + 5, (p1[2] + p2[2]) / 2] as [number, number, number],
            color: dist < 50 ? '#ff3333' : '#00ffcc'
          });
        }
      }
    }
    return res;
  }, [taxis]);

  return (
    <group>
      {lines.map((l) => (
        <group key={l.id}>
          <Line
            points={l.points}
            color={l.color}
            lineWidth={0.5}
            transparent
            opacity={0.3}
          />
          <Text
            position={l.center}
            fontSize={4}
            color={l.color}
          >
            {l.distance}M
          </Text>
        </group>
      ))}
    </group>
  );
}

function TaxiDrone({ taxi }: { taxi: Taxi }) {
  const meshRef = useRef<THREE.Group>(null);
  const pos = getPos(taxi);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.position.x = THREE.MathUtils.lerp(meshRef.current.position.x, pos[0], 0.1);
      meshRef.current.position.z = THREE.MathUtils.lerp(meshRef.current.position.z, pos[2], 0.1);
      meshRef.current.position.y = THREE.MathUtils.lerp(meshRef.current.position.y, pos[1], 0.1) + Math.sin(state.clock.elapsedTime * 2) * 0.5;
    }
  });

  const color = taxi.status === 'Critical' ? '#ff3333' : taxi.status === 'Emerging' ? '#ffcc00' : '#00ffcc';

  return (
    <group ref={meshRef}>
      <Float speed={3} rotationIntensity={0.5} floatIntensity={0.5}>
        {/* BIGGER DRONE BODY */}
        <mesh>
          <boxGeometry args={[4, 1, 4]} />
          <meshStandardMaterial color="#111" metalness={1} roughness={0.1} />
        </mesh>
        
        {/* Glow Core */}
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[2, 1.2, 2]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={4} />
        </mesh>

        {/* Rotors */}
        {[[-2.5, 0, -2.5], [2.5, 0, -2.5], [-2.5, 0, 2.5], [2.5, 0, 2.5]].map((p, i) => (
          <group key={i} position={p as [number, number, number]}>
            <mesh rotation={[0, 0, 0]}>
              <cylinderGeometry args={[0.2, 0.2, 2, 8]} />
              <meshStandardMaterial color="#333" />
            </mesh>
            <mesh position={[0, 0.5, 0]} rotation={[0, Date.now() * 0.01, 0]}>
              <boxGeometry args={[4, 0.1, 0.3]} />
              <meshStandardMaterial color="#000" transparent opacity={0.6} />
            </mesh>
          </group>
        ))}
      </Float>
      
      <Text
        position={[0, 8, 0]}
        fontSize={3}
        color="white"
        anchorX="center"
      >
        {taxi.id}
      </Text>

      <pointLight color={color} intensity={50} distance={30} />
      
      <Trail
        width={3}
        length={20}
        color={new THREE.Color(color)}
        attenuation={(t) => t * t}
      />
    </group>
  );
}

function Environment() {
  const buildings = useMemo(() => {
    return [...Array(40)].map((_, i) => ({
      id: i,
      x: (Math.random() - 0.5) * 600,
      z: (Math.random() - 0.5) * 600,
      w: 20 + Math.random() * 30,
      h: 40 + Math.random() * 120,
      d: 20 + Math.random() * 30,
      color: `hsl(180, 50%, ${5 + Math.random() * 10}%)`
    }));
  }, []);

  return (
    <group>
      <Sky sunPosition={[100, 20, 100]} />
      <Stars radius={400} depth={50} count={5000} factor={4} saturation={0} fade />
      <Grid 
        infiniteGrid 
        cellSize={50} 
        sectionSize={250} 
        sectionColor="#004444" 
        cellColor="#001111" 
        fadeDistance={1500} 
      />

      {buildings.map((b) => (
        <mesh key={b.id} position={[b.x, b.h / 2, b.z]}>
          <boxGeometry args={[b.w, b.h, b.d]} />
          <meshStandardMaterial color={b.color} metalness={0.9} roughness={0.1} />
        </mesh>
      ))}
    </group>
  );
}

export default function Airspace3D({ taxis }: Airspace3DProps) {
  return (
    <div className="w-full h-full bg-[#010101]">
      <Canvas shadows camera={{ position: [300, 300, 300], fov: 45 }}>
        <OrbitControls makeDefault />
        <ambientLight intensity={0.5} />
        <pointLight position={[100, 200, 100]} intensity={10} color="#00ffcc" />
        
        <Environment />
        <DistanceLines taxis={taxis} />
        
        {taxis.map((taxi) => (
          <TaxiDrone key={taxi.id} taxi={taxi} />
        ))}

        <fog attach="fog" args={['#010101', 100, 1000]} />
      </Canvas>
      
      <div className="absolute top-4 left-4 font-mono text-[10px] text-[#00ffcc] bg-black/90 p-2 border border-[#00ffcc]/30 uppercase tracking-[0.2em]">
        UAM_SPATIAL_V3 // LIVE_DISTANCE_TRACKING
      </div>
    </div>
  );
}
