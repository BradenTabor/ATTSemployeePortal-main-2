import React, { useState, useEffect, useRef } from "react";

interface VideoBackgroundProps {
  videoSrc: string;
  children: React.ReactNode;
}

export const VideoBackground: React.FC<VideoBackgroundProps> = ({
  videoSrc,
  children,
}) => {
  const [loaded, setLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleCanPlay = async () => {
      try {
        await video.play();
        setLoaded(true);
      } catch (err) {
        console.warn("Autoplay may be blocked:", err);
        setLoaded(true);
      }
    };

    video.addEventListener("canplaythrough", handleCanPlay);
    return () => video.removeEventListener("canplaythrough", handleCanPlay);
  }, []);

  return (
    <div className="relative w-full min-h-screen overflow-hidden">
      <video
        ref={videoRef}
        src={videoSrc}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        className={`absolute top-0 left-0 w-full h-full object-cover transition-opacity duration-1000 ${
          loaded ? "opacity-100" : "opacity-0"
        } z-0`}
        onLoadedData={() => setLoaded(true)}
        onError={(e) => console.error("Video load error:", e)}
      />

      <div className="absolute inset-0 bg-gradient-to-br from-green-900/60 via-green-800/50 to-green-700/40 z-10"></div>

      <div className="relative z-20 flex flex-col items-center justify-center min-h-screen text-white text-center px-4">
        {children}
      </div>
    </div>
  );
};
