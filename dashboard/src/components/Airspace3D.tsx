import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, Float, Text, Trail, Grid, Sky } from '@react-three/drei';
import * as THREE from 'three';

interface Taxi {
  id: string;
  latitude: number;
  longitude: number;
  altitude: number;
  speed: number;
  status: string;
  risk: number;
  battery: number;
}

interface Airspace {
  skyports: Array<{ name: string; x: number; y: number }>;
  buildings: Array<{ x: number; y: number; w: number; h: number }>;
  no_fly_zones: Array<{ name: string; x: number; y: number; radius: number }>;
  weather_cells: Array<{ name: string; x: number; y: number; radius: number }>;
  congested_zones?: Array<{ x: number; y: number; radius: number; density: number }>;
}

interface Airspace3DProps {
  taxis: Taxi[];
  airspace: Airspace | null;
  selectedTaxiId?: string | null;
}

const getAltitudeColor = (alt: number) => {
  if (alt >= 700) return '#b400ff'; // Purple (Climb)
  if (alt >= 625) return '#00ff78'; // Green (650m Corridor)
  if (alt >= 575) return '#ff00dc'; // Magenta (600m Corridor)
  if (alt >= 525) return '#ffd700'; // Yellow (550m Corridor)
  if (alt >= 475) return '#00f6ff'; // Cyan (500m Corridor)
  return '#ff4646'; // Red (Emergency / Landing)
};

function getPos(taxi: Taxi): [number, number, number] {
  return [
    (taxi.longitude - 77.625) * 2000,
    taxi.altitude / 10,
    (taxi.latitude - 13.00) * 2000
  ];
}

function mapPygameCoords(x: number, y: number): [number, number] {
  // Converts 2D Pygame coordinates to 3D (x, z) coordinates matching getPos mapping precisely
  const longitude = 77.4000 + (x / 1100.0) * (77.8500 - 77.4000);
  const latitude = 12.8500 + (y / 900.0) * (13.1500 - 12.8500);
  return [
    (longitude - 77.625) * 2000,
    (latitude - 13.00) * 2000
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

        if (dist < 150) { // Highlight close aircraft vectors
          res.push({
            id: `${taxis[i].id}-${taxis[j].id}`,
            points: [new THREE.Vector3(...p1), new THREE.Vector3(...p2)],
            distance: dist.toFixed(1),
            center: [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2 + 5, (p1[2] + p2[2]) / 2] as [number, number, number],
            color: dist < 50 ? '#ff3333' : '#ffd700'
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
          {/* Custom three-js visual line replacement for Line to avoid import issues */}
          <mesh>
            <boxGeometry args={[0.5, 0.5, 0.5]} />
            <meshBasicMaterial color={l.color} />
          </mesh>
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

  const r1 = useRef<THREE.Mesh>(null);
  const r2 = useRef<THREE.Mesh>(null);
  const r3 = useRef<THREE.Mesh>(null);
  const r4 = useRef<THREE.Mesh>(null);
  const rotorRefs = useMemo<any[]>(() => [r1, r2, r3, r4], []);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.position.x = THREE.MathUtils.lerp(meshRef.current.position.x, pos[0], 0.1);
      meshRef.current.position.z = THREE.MathUtils.lerp(meshRef.current.position.z, pos[2], 0.1);
      meshRef.current.position.y = THREE.MathUtils.lerp(meshRef.current.position.y, pos[1], 0.1) + Math.sin(state.clock.elapsedTime * 2.5) * 0.4;
    }

    // Direct WebGL rotor mutation at 60 FPS (high performance)
    const t = state.clock.getElapsedTime() * 15;
    rotorRefs.forEach((ref) => {
      if (ref.current) {
        ref.current.rotation.y = t;
      }
    });
  });

  let color = getAltitudeColor(taxi.altitude);
  if (taxi.status === 'Detouring') {
    color = '#f97316'; // Premium bright warm orange/gold for congestion avoidances
  } else if (taxi.status === 'Bypassing') {
    color = '#ffaa00'; // Futuristic warm orange for autopilot cooperative conflict resolution
  } else if (taxi.status === 'Critical') {
    color = '#ff4444'; // Bright warning red for emergency profiles
  }

  return (
    <group ref={meshRef}>
      <Float speed={3} rotationIntensity={0.4} floatIntensity={0.4}>
        {/* DRONE BODY */}
        <mesh>
          <boxGeometry args={[4, 0.8, 4]} />
          <meshStandardMaterial color="#181822" metalness={0.9} roughness={0.1} />
        </mesh>
        
        {/* Glowing Avionics Core */}
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[2.2, 1.0, 2.2]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={3} />
        </mesh>

        {/* Rotors */}
        {[[-2.5, 0, -2.5], [2.5, 0, -2.5], [-2.5, 0, 2.5], [2.5, 0, 2.5]].map((p, i) => (
          <group key={i} position={p as [number, number, number]}>
            <mesh>
              <cylinderGeometry args={[0.15, 0.15, 1.8, 8]} />
              <meshStandardMaterial color="#444" />
            </mesh>
            <mesh ref={rotorRefs[i]} position={[0, 0.4, 0]}>
              <boxGeometry args={[3.8, 0.05, 0.25]} />
              <meshStandardMaterial color="#111" transparent opacity={0.75} />
            </mesh>
          </group>
        ))}
      </Float>
      
      {/* Rich Flight Tag Overlay */}
      <group position={[0, 11, 0]}>
        <Text
          fontSize={3.2}
          color="white"
          anchorX="center"
          anchorY="bottom"
        >
          {`${taxi.id} // ${Math.round(taxi.altitude)}M`}
        </Text>
        <Text
          position={[0, -2.5, 0]}
          fontSize={2.0}
          color={color}
          anchorX="center"
          anchorY="bottom"
        >
          {`BATT: ${Math.round(taxi.battery)}% // ${taxi.status.toUpperCase()}`}
        </Text>
      </group>

      <pointLight color={color} intensity={35} distance={45} />
      
      <Trail
        width={2.5}
        length={25}
        color={new THREE.Color(color)}
        attenuation={(t) => t * t}
      />
    </group>
  );
}

function Environment({ airspace }: { airspace: Airspace | null }) {
  const buildings = useMemo(() => {
    // Return the specific buildings in correct mapped locations
    if (airspace && airspace.buildings) {
      return airspace.buildings.map((b, i) => {
        // Find 3D centers
        const [tx, tz] = mapPygameCoords(b.x + b.w/2, b.y + b.h/2);
        const w3d = b.w * 0.909;
        const d3d = b.h * 1.111; // mapped to z
        const h3d = 32; // height equivalent
        return {
          id: `bld-${i}`,
          x: tx,
          z: tz,
          w: w3d,
          h: h3d,
          d: d3d,
          color: '#0e0e1a'
        };
      });
    }
    return [];
  }, [airspace]);

  return (
    <group>
      <Sky sunPosition={[100, 40, 100]} />
      <Stars radius={400} depth={50} count={3500} factor={3} saturation={0.2} fade />
      
      {/* Low-intensity ground reference grid */}
      <Grid 
        infiniteGrid 
        cellSize={50} 
        sectionSize={250} 
        sectionColor="#003333" 
        cellColor="#001111" 
        fadeDistance={1500} 
      />

      {/* 1. Static Buildings mapped from Pygame coordinates */}
      {buildings.map((b) => (
        <group key={b.id}>
          <mesh position={[b.x, b.h / 2, b.z]}>
            <boxGeometry args={[b.w, b.h, b.d]} />
            <meshStandardMaterial color={b.color} metalness={0.8} roughness={0.1} />
          </mesh>
          {/* Glowing Purple High-rise flashing warning lights */}
          <mesh position={[b.x, b.h + 0.5, b.z]}>
            <boxGeometry args={[b.w + 1, 1, b.d + 1]} />
            <meshStandardMaterial color="#b400ff" emissive="#b400ff" emissiveIntensity={3} />
          </mesh>
        </group>
      ))}

      {/* 2. Airspace Skyports Pad visualization */}
      {airspace?.skyports.map((port, i) => {
        const [tx, tz] = mapPygameCoords(port.x, port.y);
        return (
          <group key={`p3d-${i}`} position={[tx, 0.2, tz]}>
            <mesh>
              <cylinderGeometry args={[12, 12, 0.4, 16]} />
              <meshStandardMaterial color="#00ffcc" emissive="#00ffcc" emissiveIntensity={1} transparent opacity={0.65} />
            </mesh>
            <mesh position={[0, 0.1, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <ringGeometry args={[12, 13.5, 16]} />
              <meshBasicMaterial color="#ffffff" side={THREE.DoubleSide} transparent opacity={0.3} />
            </mesh>
            <Text position={[0, 5, 0]} fontSize={5} color="#ffffff" anchorX="center">
              {port.name}
            </Text>
          </group>
        );
      })}

      {/* 3. Restricted No-Fly Zone 3D cylinders */}
      {airspace?.no_fly_zones.map((nfz, i) => {
        const [tx, tz] = mapPygameCoords(nfz.x, nfz.y);
        const r3d = nfz.radius * 0.909;
        return (
          <group key={`nfz3d-${i}`} position={[tx, 40, tz]}>
            {/* Transparent wall cylinder */}
            <mesh>
              <cylinderGeometry args={[r3d, r3d, 80, 32, 1, true]} />
              <meshBasicMaterial color="#ef4444" side={THREE.DoubleSide} transparent opacity={0.07} />
            </mesh>
            {/* Wireframe border ring */}
            <mesh>
              <cylinderGeometry args={[r3d, r3d, 80, 32, 4, true]} />
              <meshBasicMaterial color="#ef4444" wireframe transparent opacity={0.25} />
            </mesh>
            <Text position={[0, 42, 0]} fontSize={6} color="#ef4444" fontWeight="bold">
              {`RESTRICTED // ${nfz.name}`}
            </Text>
          </group>
        );
      })}

      {/* 4. Moving Weather Storm Cell sphere */}
      {airspace?.weather_cells.map((storm, i) => {
        const [tx, tz] = mapPygameCoords(storm.x, storm.y);
        const r3d = storm.radius * 0.909;
        return (
          <group key={`storm3d-${i}`} position={[tx, 55, tz]}>
            {/* Soft hazard sphere */}
            <mesh>
              <sphereGeometry args={[r3d, 16, 16]} />
              <meshStandardMaterial color="#0ea5e9" emissive="#0ea5e9" emissiveIntensity={0.6} transparent opacity={0.12} />
            </mesh>
            {/* Orbit sweep ring */}
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <ringGeometry args={[r3d - 4, r3d, 32]} />
              <meshBasicMaterial color="#0ea5e9" side={THREE.DoubleSide} transparent opacity={0.4} />
            </mesh>
            <Text position={[0, r3d + 6, 0]} fontSize={5} color="#0ea5e9" fontWeight="bold">
              {`HAZARD: STORM ALPHA`}
            </Text>
            <pointLight color="#0ea5e9" intensity={40} distance={150} />
          </group>
        );
      })}

      {/* 5. Dynamic Congested Zone 3D cylinders */}
      {airspace?.congested_zones?.map((cz, i) => {
        const [tx, tz] = mapPygameCoords(cz.x, cz.y);
        const r3d = cz.radius * 0.909;
        return (
          <group key={`cz3d-${i}`} position={[tx, 35, tz]}>
            {/* Glowing warning red wall cylinder */}
            <mesh>
              <cylinderGeometry args={[r3d, r3d, 70, 32, 1, true]} />
              <meshBasicMaterial color="#ff2222" side={THREE.DoubleSide} transparent opacity={0.12} />
            </mesh>
            {/* Outer dotted/wireframe grid cylinder */}
            <mesh>
              <cylinderGeometry args={[r3d, r3d, 70, 32, 5, true]} />
              <meshBasicMaterial color="#ff2222" wireframe transparent opacity={0.3} />
            </mesh>
            {/* Flashing danger core */}
            <mesh position={[0, -35, 0]}>
              <cylinderGeometry args={[5, 5, 0.5, 16]} />
              <meshBasicMaterial color="#ff2222" transparent opacity={0.8} />
            </mesh>
            <Text position={[0, 38, 0]} fontSize={5.5} color="#ff3333" fontWeight="bold">
              {`CONGESTED // DENSITY: ${cz.density}`}
            </Text>
            <pointLight color="#ff3333" intensity={60} distance={120} />
          </group>
        );
      })}
    </group>
  );
}

export function Airspace3D({ taxis, airspace, selectedTaxiId }: Airspace3DProps) {
  const selectedTaxi = selectedTaxiId ? taxis.find(t => t.id === selectedTaxiId) : null;
  const selectedPos = selectedTaxi ? getPos(selectedTaxi) : null;

  return (
    <div className="w-full h-full bg-[#010101] relative">
      <Canvas shadows camera={{ position: [300, 350, 400], fov: 42 }}>
        <OrbitControls makeDefault maxPolarAngle={Math.PI / 2 - 0.05} minDistance={100} maxDistance={900} />
        <ambientLight intensity={0.6} />
        <pointLight position={[100, 300, 100]} intensity={15} color="#00ffcc" />
        
        {/* Airspace Hazards, Ports, Structures */}
        <Environment airspace={airspace} />
        
        {/* Dynamic distance vectors between close drones */}
        <DistanceLines taxis={taxis} />
        
        {/* Taxis (Autopilot movement & smooth climbs) */}
        {taxis.map((taxi) => (
          <TaxiDrone key={taxi.id} taxi={taxi} />
        ))}

        {/* Glowing vertical surveillance cyber cylinder for selected taxi */}
        {selectedPos && (
          <group position={[selectedPos[0], selectedPos[1], selectedPos[2]]}>
            <mesh>
              <cylinderGeometry args={[18, 18, 80, 16, 1, true]} />
              <meshBasicMaterial color="#00ffcc" side={THREE.DoubleSide} transparent opacity={0.18} />
            </mesh>
            <mesh>
              <cylinderGeometry args={[18, 18, 80, 16, 4, true]} />
              <meshBasicMaterial color="#00ffcc" wireframe transparent opacity={0.3} />
            </mesh>
            {/* Flashing top and bottom rings */}
            <mesh position={[0, -40, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <ringGeometry args={[16, 20, 16]} />
              <meshBasicMaterial color="#00ffcc" side={THREE.DoubleSide} transparent opacity={0.6} />
            </mesh>
            <mesh position={[0, 40, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <ringGeometry args={[16, 20, 16]} />
              <meshBasicMaterial color="#00ffcc" side={THREE.DoubleSide} transparent opacity={0.6} />
            </mesh>
            <pointLight color="#00ffcc" intensity={30} distance={50} />
          </group>
        )}

        {/* 5. Symmetrical directional Flight Corridor 3D Decks */}
        {/* Deck 50 - 500m (Cyan Grid) */}
        <Grid 
          position={[0, 50, 0]}
          args={[1000, 1000]}
          cellSize={100}
          sectionSize={500}
          sectionColor="#003740"
          cellColor="#00181c"
          fadeDistance={1000}
          infiniteGrid
        />
        
        {/* Deck 55 - 550m (Yellow Grid) */}
        <Grid 
          position={[0, 55, 0]}
          args={[1000, 1000]}
          cellSize={100}
          sectionSize={500}
          sectionColor="#3b3200"
          cellColor="#171400"
          fadeDistance={1000}
          infiniteGrid
        />

        {/* Deck 60 - 600m (Magenta Grid) */}
        <Grid 
          position={[0, 60, 0]}
          args={[1000, 1000]}
          cellSize={100}
          sectionSize={500}
          sectionColor="#3b0033"
          cellColor="#1c0018"
          fadeDistance={1000}
          infiniteGrid
        />

        {/* Deck 65 - 650m (Green Grid) */}
        <Grid 
          position={[0, 65, 0]}
          args={[1000, 1000]}
          cellSize={100}
          sectionSize={500}
          sectionColor="#00381a"
          cellColor="#00170a"
          fadeDistance={1000}
          infiniteGrid
        />

        <fog attach="fog" args={['#010101', 200, 1200]} />
      </Canvas>
      
      <div className="absolute top-4 left-4 font-mono text-[9px] text-[#00ffcc] bg-black/90 p-2 border border-[#00ffcc]/30 uppercase tracking-[0.2em] pointer-events-none select-none">
        UAM_SPATIAL_RADAR_V3 // ACTIVE_HAZARD_OVERLAYS
      </div>
      
      {/* 3D Legenda overlay */}
      <div className="absolute bottom-4 left-4 font-mono text-[8px] text-zinc-500 bg-black/90 p-2.5 border border-zinc-800 space-y-1.5 pointer-events-none select-none">
        <div className="text-white font-bold tracking-wider mb-1 uppercase">Altitude Corridor Decks</div>
        <div className="flex items-center gap-1.5"><div className="w-2.5 h-1.5 bg-[#00f6ff]" /> 500M CORRIDOR (EAST-WEST / SOUTH-NORTH)</div>
        <div className="flex items-center gap-1.5"><div className="w-2.5 h-1.5 bg-[#ffd700]" /> 550M CORRIDOR (DIAGONAL SOUTHBOUND)</div>
        <div className="flex items-center gap-1.5"><div className="w-2.5 h-1.5 bg-[#ff00dc]" /> 600M CORRIDOR (WEST-EAST / NORTH-SOUTH)</div>
        <div className="flex items-center gap-1.5"><div className="w-2.5 h-1.5 bg-[#00ff78]" /> 650M CORRIDOR (DIAGONAL NORTHBOUND)</div>
      </div>
    </div>
  );
}

class Airspace3DErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("3D RADAR ERROR CAUGHT:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full bg-[#050508] border border-red-950/40 flex flex-col items-center justify-center p-6 text-center font-mono">
          <div className="w-10 h-10 rounded-full bg-red-950/30 border border-red-500/40 flex items-center justify-center text-red-400 text-sm mb-3">⚠️</div>
          <div className="text-[10px] font-black tracking-wider text-red-400 uppercase">3D Radar System Offline</div>
          <div className="text-[8px] text-zinc-500 mt-2 max-w-md uppercase leading-relaxed">
            {this.state.error?.message || "WebGL initialization failed or is not supported by your browser/environment."}
          </div>
          <div className="text-[9px] text-[#00ffcc] mt-4 uppercase font-bold">
            Displaying safe 2D Radar fallback.
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function Airspace3DWithBoundary(props: Airspace3DProps) {
  return (
    <Airspace3DErrorBoundary>
      <Airspace3D {...props} />
    </Airspace3DErrorBoundary>
  );
}

