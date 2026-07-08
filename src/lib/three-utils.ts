import * as THREE from 'three';

/**
 * Three.js utility functions for creating optimized scenes, cameras, and renderers
 */

export const createOptimizedScene = () => {
  const scene = new THREE.Scene();
  scene.background = null;
  scene.fog = new THREE.Fog(0x0a0e27, 100, 500);
  return scene;
};

export const createOptimizedCamera = (width: number, height: number) => {
  const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
  camera.position.z = 30;
  return camera;
};

export const createOptimizedRenderer = (canvas: HTMLCanvasElement, width: number, height: number) => {
  const renderer = new THREE.WebGLRenderer({ 
    canvas, 
    antialias: true, 
    alpha: true,
    precision: 'mediump',
    powerPreference: 'high-performance',
    stencil: false
  });
  
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  
  return renderer;
};

export const createGradientTexture = (
  colors: string[],
  width: number = 256,
  height: number = 256
): THREE.CanvasTexture => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  
  colors.forEach((color, i) => {
    gradient.addColorStop(i / (colors.length - 1), color);
  });
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  return texture;
};

export const easeInOutCubic = (t: number): number => {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};

export const easeOutQuad = (t: number): number => {
  return 1 - (1 - t) * (1 - t);
};

export const easeOutQuart = (t: number): number => {
  return 1 - Math.pow(1 - t, 4);
};

export const lerp = (a: number, b: number, t: number): number => {
  return a + (b - a) * t;
};

// Cleanup function to properly dispose Three.js resources
export const disposeScene = (scene: THREE.Scene, renderer: THREE.WebGLRenderer) => {
  scene.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      if (object.geometry) object.geometry.dispose();
      if (object.material) {
        if (Array.isArray(object.material)) {
          object.material.forEach((mat) => mat.dispose());
        } else {
          object.material.dispose();
        }
      }
    }
  });
  renderer.dispose();
};
