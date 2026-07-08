'use client';

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface InteractiveHeroProps {
  onLoadComplete?: () => void;
}

export const InteractiveHero3D: React.FC<InteractiveHeroProps> = ({ onLoadComplete }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x020817, 0.012);

    // Camera
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.set(0, 0, 35);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setClearColor(0x020817, 1);
    renderer.shadowMap.enabled = false;
    container.appendChild(renderer.domElement);

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.3));

    const pointLight1 = new THREE.PointLight(0x6366f1, 3, 80);
    pointLight1.position.set(-20, 15, 20);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0x06b6d4, 2, 80);
    pointLight2.position.set(20, -10, 15);
    scene.add(pointLight2);

    const pointLight3 = new THREE.PointLight(0xf43f5e, 1.5, 60);
    pointLight3.position.set(0, 20, -20);
    scene.add(pointLight3);

    // Neural Network Node Graph
    const nodeCount = 60;
    const nodePositions: THREE.Vector3[] = [];
    const nodeMeshes: THREE.Mesh[] = [];
    const nodeGeom = new THREE.SphereGeometry(0.18, 8, 8);

    for (let i = 0; i < nodeCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 12 + Math.random() * 10;
      const pos = new THREE.Vector3(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta) * 0.7,
        r * Math.cos(phi)
      );
      nodePositions.push(pos);

      const hue = 0.63 + Math.random() * 0.15;
      const mat = new THREE.MeshPhongMaterial({
        color: new THREE.Color().setHSL(hue, 0.8, 0.65),
        emissive: new THREE.Color().setHSL(hue, 0.8, 0.3),
        emissiveIntensity: 0.8,
        shininess: 120,
      });
      const node = new THREE.Mesh(nodeGeom, mat);
      node.position.copy(pos);
      scene.add(node);
      nodeMeshes.push(node);
    }

    // Connection Lines
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x6366f1,
      transparent: true,
      opacity: 0.2,
    });
    const connectionDistance = 10;
    for (let i = 0; i < nodeCount; i++) {
      for (let j = i + 1; j < nodeCount; j++) {
        if (nodePositions[i].distanceTo(nodePositions[j]) < connectionDistance) {
          const lineGeom = new THREE.BufferGeometry().setFromPoints([
            nodePositions[i],
            nodePositions[j],
          ]);
          scene.add(new THREE.Line(lineGeom, lineMat));
        }
      }
    }

    // Central glowing sphere
    const coreGeom = new THREE.SphereGeometry(1.8, 32, 32);
    const coreMat = new THREE.MeshPhongMaterial({
      color: 0x6366f1,
      emissive: 0x4f46e5,
      emissiveIntensity: 1.5,
      shininess: 200,
      transparent: true,
      opacity: 0.9,
    });
    const core = new THREE.Mesh(coreGeom, coreMat);
    scene.add(core);

    // Outer wireframe ring
    const ringGeom = new THREE.TorusGeometry(22, 0.05, 8, 100);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x6366f1, transparent: true, opacity: 0.15 });
    const ring = new THREE.Mesh(ringGeom, ringMat);
    ring.rotation.x = Math.PI / 4;
    scene.add(ring);

    const ring2Geom = new THREE.TorusGeometry(18, 0.04, 8, 100);
    const ring2 = new THREE.Mesh(ring2Geom, new THREE.MeshBasicMaterial({ color: 0x8b5cf6, transparent: true, opacity: 0.1 }));
    ring2.rotation.x = -Math.PI / 3;
    ring2.rotation.y = Math.PI / 6;
    scene.add(ring2);

    // Mouse
    const mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
    const onMouseMove = (e: MouseEvent) => {
      mouse.targetX = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.targetY = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener('mousemove', onMouseMove);

    // Animation
    let t = 0;
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);
      t += 0.005;

      // Smooth mouse follow
      mouse.x += (mouse.targetX - mouse.x) * 0.04;
      mouse.y += (mouse.targetY - mouse.y) * 0.04;

      // Rotate whole scene slowly
      scene.rotation.y = mouse.x * 0.3 + t * 0.1;
      scene.rotation.x = mouse.y * 0.15;

      // Pulse nodes
      nodeMeshes.forEach((node, i) => {
        const scale = 1 + 0.25 * Math.sin(t * 1.5 + i * 0.4);
        node.scale.setScalar(scale);
      });

      // Core pulse
      const coreScale = 1 + 0.15 * Math.sin(t * 2);
      core.scale.setScalar(coreScale);
      (coreMat as THREE.MeshPhongMaterial).emissiveIntensity = 1.2 + 0.5 * Math.sin(t * 2);

      // Ring rotation
      ring.rotation.z += 0.003;
      ring2.rotation.z -= 0.002;
      ring2.rotation.x += 0.001;

      // Light animation
      pointLight1.position.x = Math.sin(t * 0.7) * 25;
      pointLight1.position.z = Math.cos(t * 0.7) * 25;
      pointLight2.position.x = Math.cos(t * 0.5) * 25;
      pointLight2.position.z = Math.sin(t * 0.5) * 25;

      renderer.render(scene, camera);
    };

    animate();
    onLoadComplete?.();

    const onResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize', onResize);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  }, [onLoadComplete]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-screen overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #020817 0%, #0a0f2e 50%, #060d24 100%)' }}
    >
      <div className="absolute inset-0 bg-gradient-to-t from-[#020817] via-transparent to-transparent opacity-60 pointer-events-none z-10" />
    </div>
  );
};

export default InteractiveHero3D;
