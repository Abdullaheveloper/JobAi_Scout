'use client';

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface FloatingObjectsProps {
  backgroundColor?: string;
  onLoadComplete?: () => void;
}

export const FloatingObjects3D: React.FC<FloatingObjectsProps> = ({ 
  backgroundColor = '#020817',
  onLoadComplete 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(70, width / height, 0.1, 1000);
    camera.position.z = 50;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setClearColor(new THREE.Color(backgroundColor), 1);
    container.appendChild(renderer.domElement);

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const pLight1 = new THREE.PointLight(0x6366f1, 2, 150);
    pLight1.position.set(30, 30, 30);
    scene.add(pLight1);
    const pLight2 = new THREE.PointLight(0x06b6d4, 1.5, 120);
    pLight2.position.set(-30, -20, 20);
    scene.add(pLight2);
    const pLight3 = new THREE.PointLight(0xf43f5e, 1, 100);
    pLight3.position.set(0, 30, -30);
    scene.add(pLight3);

    // DNA Helix pairs
    const helixObjects: { mesh: THREE.Mesh; baseAngle: number; helixRadius: number; yOffset: number; speed: number }[] = [];
    const helixCount = 24;
    const totalHeight = 60;
    const helixRadius = 8;

    const colors = [0x6366f1, 0x8b5cf6, 0x06b6d4, 0xf43f5e, 0x10b981, 0xf59e0b];
    const sphereGeom = new THREE.SphereGeometry(0.6, 16, 16);

    for (let i = 0; i < helixCount; i++) {
      const t = i / helixCount;
      const baseAngle = t * Math.PI * 4;
      const y = t * totalHeight - totalHeight / 2;
      const colorA = colors[i % colors.length];
      const colorB = colors[(i + 3) % colors.length];

      // Strand A
      const matA = new THREE.MeshPhongMaterial({
        color: colorA,
        emissive: colorA,
        emissiveIntensity: 0.4,
        shininess: 80,
      });
      const sphereA = new THREE.Mesh(sphereGeom, matA);
      sphereA.position.set(
        Math.cos(baseAngle) * helixRadius,
        y,
        Math.sin(baseAngle) * helixRadius
      );
      scene.add(sphereA);

      // Strand B (opposite)
      const matB = new THREE.MeshPhongMaterial({
        color: colorB,
        emissive: colorB,
        emissiveIntensity: 0.4,
        shininess: 80,
      });
      const sphereB = new THREE.Mesh(sphereGeom, matB);
      sphereB.position.set(
        Math.cos(baseAngle + Math.PI) * helixRadius,
        y,
        Math.sin(baseAngle + Math.PI) * helixRadius
      );
      scene.add(sphereB);

      // Connecting rung
      const rungGeom = new THREE.CylinderGeometry(0.08, 0.08, helixRadius * 2, 6);
      const rungMat = new THREE.MeshPhongMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.12,
      });
      const rung = new THREE.Mesh(rungGeom, rungMat);
      rung.position.set(0, y, 0);
      rung.rotation.z = Math.PI / 2;
      rung.rotation.y = baseAngle;
      scene.add(rung);

      helixObjects.push({ mesh: sphereA, baseAngle, helixRadius, yOffset: y, speed: 0.3 + Math.random() * 0.2 });
    }

    // Floating icosahedra in background
    const bgObjects: { mesh: THREE.Mesh; rotSpeed: THREE.Vector3; floatOffset: number }[] = [];
    const icoGeom = new THREE.IcosahedronGeometry(1.5, 1);
    for (let i = 0; i < 8; i++) {
      const mat = new THREE.MeshPhongMaterial({
        color: colors[i % colors.length],
        wireframe: true,
        transparent: true,
        opacity: 0.25,
      });
      const ico = new THREE.Mesh(icoGeom, mat);
      ico.position.set(
        (Math.random() - 0.5) * 80,
        (Math.random() - 0.5) * 60,
        -20 - Math.random() * 20
      );
      scene.add(ico);
      bgObjects.push({
        mesh: ico,
        rotSpeed: new THREE.Vector3(
          (Math.random() - 0.5) * 0.01,
          (Math.random() - 0.5) * 0.01,
          (Math.random() - 0.5) * 0.01
        ),
        floatOffset: Math.random() * Math.PI * 2,
      });
    }

    let t = 0;
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);
      t += 0.005;

      // Rotate helix group
      scene.rotation.y = t * 0.15;

      // Pulse helix nodes
      helixObjects.forEach((obj, i) => {
        const scale = 1 + 0.3 * Math.sin(t * 2 + i * 0.2);
        obj.mesh.scale.setScalar(scale);
      });

      // Animate bg objects
      bgObjects.forEach((obj) => {
        obj.mesh.rotation.x += obj.rotSpeed.x;
        obj.mesh.rotation.y += obj.rotSpeed.y;
        obj.mesh.rotation.z += obj.rotSpeed.z;
        obj.mesh.position.y += Math.sin(t + obj.floatOffset) * 0.05;
      });

      // Orbit lights
      pLight1.position.x = Math.sin(t * 0.5) * 40;
      pLight1.position.z = Math.cos(t * 0.5) * 40;
      pLight2.position.x = Math.cos(t * 0.4) * 40;
      pLight2.position.z = Math.sin(t * 0.4) * 40;

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
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  }, [backgroundColor, onLoadComplete]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden"
      style={{ minHeight: '500px' }}
    />
  );
};

export default FloatingObjects3D;
