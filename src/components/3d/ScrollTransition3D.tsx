'use client';

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface ScrollTransition3DProps {
  progress?: number;
  onLoadComplete?: () => void;
}

export const ScrollTransition3D: React.FC<ScrollTransition3DProps> = ({ 
  progress = 0,
  onLoadComplete 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number>();
  const progressRef = useRef(progress);

  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 500);
    camera.position.z = 30;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const pLight = new THREE.PointLight(0x8b5cf6, 3, 100);
    pLight.position.set(0, 10, 20);
    scene.add(pLight);
    const pLight2 = new THREE.PointLight(0x06b6d4, 2, 80);
    pLight2.position.set(-20, -10, 10);
    scene.add(pLight2);

    // Morph geometries
    const geometries = [
      new THREE.IcosahedronGeometry(6, 2),
      new THREE.TorusKnotGeometry(4, 1.2, 100, 16),
      new THREE.OctahedronGeometry(6, 2),
    ];

    const material = new THREE.MeshPhongMaterial({
      color: 0x6366f1,
      emissive: 0x4338ca,
      emissiveIntensity: 0.5,
      shininess: 120,
      wireframe: false,
      transparent: true,
      opacity: 0.85,
    });

    const mainMesh = new THREE.Mesh(geometries[0], material);
    scene.add(mainMesh);

    // Wireframe overlay
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0x818cf8,
      wireframe: true,
      transparent: true,
      opacity: 0.15,
    });
    const wireMesh = new THREE.Mesh(geometries[0], wireMat);
    scene.add(wireMesh);

    // Orbiting dots
    const orbitCount = 6;
    const orbitMeshes: THREE.Mesh[] = [];
    const orbitGeom = new THREE.SphereGeometry(0.3, 8, 8);
    for (let i = 0; i < orbitCount; i++) {
      const orbitMat = new THREE.MeshPhongMaterial({
        color: [0x6366f1, 0x8b5cf6, 0x06b6d4, 0xf43f5e, 0x10b981, 0xf59e0b][i],
        emissive: [0x6366f1, 0x8b5cf6, 0x06b6d4, 0xf43f5e, 0x10b981, 0xf59e0b][i],
        emissiveIntensity: 0.8,
      });
      const orbit = new THREE.Mesh(orbitGeom, orbitMat);
      scene.add(orbit);
      orbitMeshes.push(orbit);
    }

    let t = 0;
    let currentGeomIndex = 0;
    let morphProgress = 0;

    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);
      t += 0.01;

      const p = progressRef.current;
      const targetGeomIndex = Math.floor(p * geometries.length) % geometries.length;

      if (targetGeomIndex !== currentGeomIndex) {
        morphProgress += 0.05;
        if (morphProgress >= 1) {
          morphProgress = 0;
          currentGeomIndex = targetGeomIndex;
          mainMesh.geometry = geometries[currentGeomIndex];
          wireMesh.geometry = geometries[currentGeomIndex];
        }
        const scale = 1 + Math.sin(morphProgress * Math.PI) * 0.3;
        mainMesh.scale.setScalar(scale);
        wireMesh.scale.setScalar(scale);
      } else {
        mainMesh.scale.setScalar(1);
        wireMesh.scale.setScalar(1);
      }

      mainMesh.rotation.x = t * 0.3;
      mainMesh.rotation.y = t * 0.5;
      wireMesh.rotation.x = t * 0.3;
      wireMesh.rotation.y = t * 0.5;

      // Orbit the dots
      orbitMeshes.forEach((orb, i) => {
        const angle = t * 0.8 + (i / orbitCount) * Math.PI * 2;
        const radius = 10 + Math.sin(t * 0.5 + i) * 2;
        orb.position.x = Math.cos(angle) * radius;
        orb.position.y = Math.sin(angle * 0.7) * 5;
        orb.position.z = Math.sin(angle) * radius;
      });

      pLight.position.x = Math.sin(t * 0.5) * 15;
      pLight.position.z = Math.cos(t * 0.5) * 15;

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
      window.removeEventListener('resize', onResize);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      geometries.forEach(g => g.dispose());
      material.dispose();
      wireMat.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  }, [onLoadComplete]);

  return (
    <div
      ref={containerRef}
      className="relative w-full pointer-events-none"
      style={{ height: '400px' }}
    />
  );
};

export default ScrollTransition3D;
