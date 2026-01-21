/**
 * iPhone 15 Pro Mockup Component (Premium Edition)
 * 
 * A photorealistic iPhone device frame with:
 * - Titanium frame gradients
 * - Glass reflections and highlights
 * - Realistic Dynamic Island with camera details
 * - Ambient screen reflections
 * - Premium edge lighting effects
 * - Side button bevels
 */

import { SVGProps, memo, ReactNode } from 'react';

export interface IPhoneMockupProps extends SVGProps<SVGSVGElement> {
  width?: number;
  height?: number;
  src?: string;
  videoSrc?: string;
  className?: string;
  children?: ReactNode;
  /** Frame color variant */
  frameColor?: 'titanium' | 'black' | 'white' | 'blue';
}

// Original design dimensions - DO NOT CHANGE
// The SVG is designed at 433x882, scaling is handled via width/height props
const DESIGN_WIDTH = 433;
const DESIGN_HEIGHT = 882;

export const IPhoneMockup = memo(function IPhoneMockup({
  width = 433,
  height = 882,
  src,
  videoSrc,
  className,
  children,
  frameColor = 'titanium',
  ...props
}: IPhoneMockupProps) {
  // Frame color configurations
  const frameColors = {
    titanium: {
      primary: '#3a3a3c',
      secondary: '#2c2c2e',
      highlight: '#5a5a5c',
      edge: '#6a6a6c',
    },
    black: {
      primary: '#1c1c1e',
      secondary: '#151517',
      highlight: '#3a3a3c',
      edge: '#4a4a4c',
    },
    white: {
      primary: '#e5e5e7',
      secondary: '#d1d1d6',
      highlight: '#ffffff',
      edge: '#f5f5f7',
    },
    blue: {
      primary: '#2c3e50',
      secondary: '#1a252f',
      highlight: '#4a6278',
      edge: '#5a7a98',
    },
  };

  const colors = frameColors[frameColor];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${DESIGN_WIDTH} ${DESIGN_HEIGHT}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <defs>
        {/* Titanium frame gradient */}
        <linearGradient id="frameGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={colors.highlight} />
          <stop offset="30%" stopColor={colors.primary} />
          <stop offset="70%" stopColor={colors.secondary} />
          <stop offset="100%" stopColor={colors.primary} />
        </linearGradient>
        
        {/* Frame edge highlight */}
        <linearGradient id="frameEdgeHighlight" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={colors.edge} stopOpacity="0.8" />
          <stop offset="50%" stopColor={colors.primary} stopOpacity="0.3" />
          <stop offset="100%" stopColor={colors.highlight} stopOpacity="0.6" />
        </linearGradient>
        
        {/* Screen glass gradient */}
        <linearGradient id="screenGlassGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.08" />
          <stop offset="30%" stopColor="#ffffff" stopOpacity="0.02" />
          <stop offset="70%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.03" />
        </linearGradient>
        
        {/* Screen reflection gradient */}
        <linearGradient id="screenReflection" x1="0%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.15" />
          <stop offset="40%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        
        {/* Dynamic Island gradient */}
        <radialGradient id="dynamicIslandGradient" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#0a0a0a" />
          <stop offset="80%" stopColor="#000000" />
          <stop offset="100%" stopColor="#0d0d0d" />
        </radialGradient>
        
        {/* Camera lens gradient */}
        <radialGradient id="cameraLensOuter" cx="50%" cy="30%" r="60%">
          <stop offset="0%" stopColor="#2a2a3e" />
          <stop offset="50%" stopColor="#1a1a2e" />
          <stop offset="100%" stopColor="#0d0d1a" />
        </radialGradient>
        
        <radialGradient id="cameraLensInner" cx="40%" cy="40%" r="50%">
          <stop offset="0%" stopColor="#1a1a2e" />
          <stop offset="60%" stopColor="#0d0d15" />
          <stop offset="100%" stopColor="#050508" />
        </radialGradient>
        
        <radialGradient id="cameraLensReflection" cx="30%" cy="30%" r="40%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        
        {/* Button gradient */}
        <linearGradient id="buttonGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={colors.highlight} />
          <stop offset="50%" stopColor={colors.primary} />
          <stop offset="100%" stopColor={colors.secondary} />
        </linearGradient>
        
        {/* Inner shadow for depth */}
        <filter id="innerShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="blur" />
          <feOffset in="blur" dx="2" dy="2" result="offsetBlur" />
          <feComposite in="SourceGraphic" in2="offsetBlur" operator="over" />
        </filter>
        
        {/* Outer glow */}
        <filter id="deviceGlow" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        
        {/* Screen clip path */}
        <clipPath id="iphoneScreenClip">
          <path
            d="M21.25 75C21.25 43.519 46.769 18 78.25 18H354.75C386.231 18 411.75 43.519 411.75 75V807C411.75 838.481 386.231 864 354.75 864H78.25C46.769 864 21.25 838.481 21.25 807V75Z"
          />
        </clipPath>
        
        {/* Inner bezel clip */}
        <clipPath id="innerBezelClip">
          <rect x="10" y="10" width="413" height="862" rx="70" />
        </clipPath>
      </defs>
      
      {/* Outer shadow/glow */}
      <ellipse
        cx="216.5"
        cy="890"
        rx="180"
        ry="15"
        fill="black"
        opacity="0.3"
        filter="url(#deviceGlow)"
      />
      
      {/* Volume buttons with beveled edges */}
      <g>
        {/* Silent switch */}
        <rect
          x="1"
          y="72"
          width="4"
          height="30"
          rx="1.5"
          fill="url(#buttonGradient)"
        />
        <rect
          x="2"
          y="74"
          width="1"
          height="26"
          rx="0.5"
          fill={colors.edge}
          opacity="0.5"
        />
        
        {/* Volume Up */}
        <rect
          x="0"
          y="138"
          width="5"
          height="55"
          rx="2"
          fill="url(#buttonGradient)"
        />
        <rect
          x="1"
          y="140"
          width="1.5"
          height="51"
          rx="0.75"
          fill={colors.edge}
          opacity="0.4"
        />
        
        {/* Volume Down */}
        <rect
          x="0"
          y="210"
          width="5"
          height="55"
          rx="2"
          fill="url(#buttonGradient)"
        />
        <rect
          x="1"
          y="212"
          width="1.5"
          height="51"
          rx="0.75"
          fill={colors.edge}
          opacity="0.4"
        />
      </g>
      
      {/* Power button with beveled edge */}
      <rect
        x="428"
        y="196"
        width="5"
        height="85"
        rx="2"
        fill="url(#buttonGradient)"
      />
      <rect
        x="430.5"
        y="198"
        width="1.5"
        height="81"
        rx="0.75"
        fill={colors.edge}
        opacity="0.4"
      />
      
      {/* Main frame outer edge (titanium effect) */}
      <path
        d="M6 74C6 33.6832 38.6832 1 79 1H354C394.317 1 427 33.6832 427 74V808C427 848.317 394.317 881 354 881H79C38.6832 881 6 848.317 6 808V74Z"
        fill="url(#frameGradient)"
      />
      
      {/* Frame edge highlight - left */}
      <path
        d="M6 74C6 33.6832 38.6832 1 79 1H80C40.6832 1 8 33.6832 8 74V808C8 848.317 40.6832 881 80 881H79C38.6832 881 6 848.317 6 808V74Z"
        fill="url(#frameEdgeHighlight)"
        opacity="0.6"
      />
      
      {/* Frame edge highlight - top */}
      <path
        d="M79 1H354C394.317 1 427 33.6832 427 74V76C427 35.6832 394.317 3 354 3H79C38.6832 3 6 35.6832 6 76V74C6 33.6832 38.6832 1 79 1Z"
        fill={colors.edge}
        opacity="0.5"
      />
      
      {/* Inner bezel - slightly recessed */}
      <path
        d="M14 75C14 39.1015 43.1015 10 79 10H354C389.899 10 419 39.1015 419 75V807C419 842.899 389.899 872 354 872H79C43.1015 872 14 842.899 14 807V75Z"
        fill="#0c0c0c"
      />
      
      {/* Screen bezel inner edge */}
      <path
        d="M21.25 75C21.25 43.519 46.769 18 78.25 18H354.75C386.231 18 411.75 43.519 411.75 75V807C411.75 838.481 386.231 864 354.75 864H78.25C46.769 864 21.25 838.481 21.25 807V75Z"
        fill="#080808"
      />
      
      {/* Screen area with content */}
      <g clipPath="url(#iphoneScreenClip)">
        {/* Base screen color */}
        <rect x="21.25" y="18" width="390.5" height="846" fill="#000000" />
        
        {/* Image content */}
        {src && (
          <image
            href={src}
            x="21.25"
            y="18"
            width="390.5"
            height="846"
            preserveAspectRatio="xMidYMid slice"
          />
        )}
        
        {/* Video content */}
        {videoSrc && (
          <foreignObject x="21.25" y="18" width="390.5" height="846">
            <video
              className="size-full object-cover"
              src={videoSrc}
              autoPlay
              loop
              muted
              playsInline
            />
          </foreignObject>
        )}
        
        {/* Children content area */}
        {children && (
          <foreignObject x="21.25" y="18" width="390.5" height="846">
            <div className="w-full h-full">{children}</div>
          </foreignObject>
        )}
        
        {/* Screen glass reflection overlay */}
        <rect
          x="21.25"
          y="18"
          width="390.5"
          height="846"
          fill="url(#screenGlassGradient)"
        />
        
        {/* Curved ambient reflection (top-left) */}
        <ellipse
          cx="100"
          cy="100"
          rx="200"
          ry="150"
          fill="url(#screenReflection)"
          opacity="0.5"
        />
      </g>
      
      {/* Dynamic Island - enhanced */}
      <g>
        {/* Dynamic Island shadow */}
        <path
          d="M162 41H271C275.971 41 280 45.0294 280 50C280 54.9706 275.971 59 271 59H162C157.029 59 153 54.9706 153 50C153 45.0294 157.029 41 162 41Z"
          fill="black"
          opacity="0.4"
          transform="translate(0, 2)"
        />
        
        {/* Dynamic Island base */}
        <path
          d="M162 38H271C277.627 38 283 43.3726 283 50C283 56.6274 277.627 62 271 62H162C155.373 62 150 56.6274 150 50C150 43.3726 155.373 38 162 38Z"
          fill="url(#dynamicIslandGradient)"
        />
        
        {/* Dynamic Island subtle inner highlight */}
        <path
          d="M164 40H269C274.523 40 279 44.4772 279 50C279 55.5228 274.523 60 269 60H164C158.477 60 154 55.5228 154 50C154 44.4772 158.477 40 164 40Z"
          fill="none"
          stroke="#1a1a1a"
          strokeWidth="0.5"
          opacity="0.3"
        />
        
        {/* Face ID / TrueDepth sensor area (left side) */}
        <circle cx="175" cy="50" r="4" fill="#0f0f12" />
        <circle cx="175" cy="50" r="2" fill="#1a1a22" opacity="0.5" />
        
        {/* Camera lens - outer ring */}
        <circle cx="253" cy="50" r="10" fill="url(#cameraLensOuter)" />
        
        {/* Camera lens - middle ring */}
        <circle cx="253" cy="50" r="7" fill="#0d0d1a" />
        
        {/* Camera lens - inner glass */}
        <circle cx="253" cy="50" r="5" fill="url(#cameraLensInner)" />
        
        {/* Camera lens - reflection highlights */}
        <circle cx="253" cy="50" r="5" fill="url(#cameraLensReflection)" />
        
        {/* Camera lens - center dot */}
        <circle cx="253" cy="50" r="1.5" fill="#1a1a2e" />
        
        {/* Tiny highlight on camera */}
        <circle cx="250" cy="47" r="1" fill="white" opacity="0.25" />
      </g>
      
      {/* Top speaker grille (subtle) */}
      <rect
        x="204"
        y="50"
        width="25"
        height="2"
        rx="1"
        fill="#1a1a1a"
        opacity="0.4"
      />
      
      {/* Frame inner edge shadow */}
      <path
        d="M21.25 75C21.25 43.519 46.769 18 78.25 18H354.75C386.231 18 411.75 43.519 411.75 75V807C411.75 838.481 386.231 864 354.75 864H78.25C46.769 864 21.25 838.481 21.25 807V75Z"
        fill="none"
        stroke="black"
        strokeWidth="1"
        opacity="0.3"
      />
      
      {/* Outer frame highlight (very subtle) */}
      <path
        d="M6 74C6 33.6832 38.6832 1 79 1H354C394.317 1 427 33.6832 427 74V808C427 848.317 394.317 881 354 881H79C38.6832 881 6 848.317 6 808V74Z"
        fill="none"
        stroke={colors.edge}
        strokeWidth="0.5"
        opacity="0.3"
      />
    </svg>
  );
});

export default IPhoneMockup;
