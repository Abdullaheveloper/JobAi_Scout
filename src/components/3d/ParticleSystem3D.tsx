'use client';

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface ParticleSystemProps {
  particleCount?: number;
  onLoadComplete?: () => void;
}

export const ParticleSystem3D: React.FC<ParticleSystemProps> = ({ 
  particleCount = 600,
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
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.z = 80;

    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    // Galaxy spiral particle system
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount * 3);

    const colorPalette = [
      new THREE.Color(0x6366f1),
      new THREE.Color(0x8b5cf6),
      new THREE.Color(0xc084fc),
      new THREE.Color(0x06b6d4),
      new THREE.Color(0xf472b6),
    ];

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      // Spiral galaxy distribution
      const arm = Math.floor(Math.random() * 3);
      const angle = (arm / 3) * Math.PI * 2 + Math.random() * Math.PI * 0.5;
      const radius = 5 + Math.pow(Math.random(), 0.5) * 60;
      const spiralOffset = (radius / 60) * Math.PI * 3;

      positions[i3]     = Math.cos(angle + spiralOffset) * radius + (Math.random() - 0.5) * 10;
      positions[i3 + 1] = (Math.random() - 0.5) * 15;
      positions[i3 + 2] = Math.sin(angle + spiralOffset) * radius + (Math.random() - 0.5) * 10;

      velocities[i3]     = (Math.random() - 0.5) * 0.02;
      velocities[i3 + 1] = (Math.random() - 0.5) * 0.01;
      velocities[i3 + 2] = (Math.random() - 0.5) * 0.02;

      const col = colorPalette[Math.floor(Math.random() * colorPalette.length)];
      colors[i3]     = col.r;
      colors[i3 + 1] = col.g;
      colors[i3 + 2] = col.b;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));

    const material = new THREE.PointsMaterial({
      size: 0.8,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);

    // Mouse interaction
    const mouse = { x: 0, y: 0 };
    const onMouseMove = (e: MouseEvent) => {
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener('mousemove', onMouseMove);

    let t = 0;
    const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
    const velAttr = geometry.getAttribute('velocity') as THREE.BufferAttribute;
    const posArr = posAttr.array as Float32Array;
    const velArr = velAttr.array as Float32Array;

    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);
      t += 0.002;

      particles.rotation.y = t * 0.08 + mouse.x * 0.3;
      particles.rotation.x = mouse.y * 0.15;

      // Subtle drift
      for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        posArr[i3]     += velArr[i3];
        posArr[i3 + 1] += velArr[i3 + 1];
        posArr[i3 + 2] += velArr[i3 + 2];

        if (Math.abs(posArr[i3]) > 70)     velArr[i3]     *= -0.95;
        if (Math.abs(posArr[i3 + 1]) > 30) velArr[i3 + 1] *= -0.95;
        if (Math.abs(posArr[i3 + 2]) > 70) velArr[i3 + 2] *= -0.95;

        velArr[i3]     *= 0.999;
        velArr[i3 + 1] *= 0.999;
        velArr[i3 + 2] *= 0.999;
      }
      posAttr.needsUpdate = true;

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
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  }, [particleCount, onLoadComplete]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none"
    />
  );
};

export default ParticleSystem3D;
