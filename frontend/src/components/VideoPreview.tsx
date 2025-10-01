import { gsap } from 'gsap';
// Import necessary types from React
import { useState, useRef, useEffect, FC, ReactNode, MouseEvent } from 'react';

// 1. Define the type for the component's props
type VideoPreviewProps = {
  children: ReactNode;
};

// 2. Type the component with React.FC and the props type
export const VideoPreview: FC<VideoPreviewProps> = ({ children }) => {
  const [isHovering, setIsHovering] = useState<boolean>(false);

  // 3. Type the refs with the specific HTML element they will reference
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  // 4. Type the mouse event
  const handleMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    // Null check to ensure the element is available
    if (!sectionRef.current) return;

    const { clientX, clientY, currentTarget } = event;
    const rect = currentTarget.getBoundingClientRect();

    const xOffset = clientX - (rect.left + rect.width / 2);
    const yOffset = clientY - (rect.top + rect.height / 2);

    // Null checks for refs before using them in GSAP
    if (isHovering && sectionRef.current && contentRef.current) {
      gsap.to(sectionRef.current, {
        x: xOffset,
        y: yOffset,
        rotationY: xOffset / 2,
        rotationX: -yOffset / 2,
        transformPerspective: 500,
        duration: 1,
        ease: 'power1.out',
      });

      gsap.to(contentRef.current, {
        x: -xOffset,
        y: -yOffset,
        duration: 1,
        ease: 'power1.out',
      });
    }
  };

  useEffect(() => {
    // Null checks for refs before resetting their position
    if (!isHovering && sectionRef.current && contentRef.current) {
      gsap.to(sectionRef.current, {
        x: 0,
        y: 0,
        rotationY: 0,
        rotationX: 0,
        duration: 1,
        ease: 'power1.out',
      });

      gsap.to(contentRef.current, {
        x: 0,
        y: 0,
        duration: 1,
        ease: 'power1.out',
      });
    }
  }, [isHovering]);

  return (
    <section
      ref={sectionRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      className="absolute z-50 size-full overflow-hidden rounded-lg"
      style={{
        perspective: '500px',
      }}
    >
      <div
        ref={contentRef}
        className="origin-center rounded-lg"
        style={{
          transformStyle: 'preserve-3d',
        }}
      >
        {children}
      </div>
    </section>
  );
};

export default VideoPreview;
