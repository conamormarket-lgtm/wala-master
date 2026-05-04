import React, { useRef, useEffect } from 'react';

const DraggableContainer = ({ children, className, ...props }) => {
  const ref = useRef(null);

  useEffect(() => {
    const slider = ref.current;
    if (!slider) return;

    let isDown = false;
    let startX;
    let scrollLeft;
    let isDragging = false;

    const onMouseDown = (e) => {
      isDown = true;
      isDragging = false;
      startX = e.pageX - slider.offsetLeft;
      scrollLeft = slider.scrollLeft;
    };

    const onMouseLeave = () => {
      isDown = false;
    };

    const onMouseUp = () => {
      isDown = false;
    };

    const onMouseMove = (e) => {
      if (!isDown) return;
      e.preventDefault();
      
      const x = e.pageX - slider.offsetLeft;
      const walk = (x - startX) * 1.5; // Velocity
      
      if (Math.abs(walk) > 5) {
          isDragging = true;
      }
      
      slider.scrollLeft = scrollLeft - walk;
    };

    const onClick = (e) => {
      if (isDragging) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const opts = { passive: false };
    slider.addEventListener('mousedown', onMouseDown, opts);
    slider.addEventListener('mouseleave', onMouseLeave, opts);
    slider.addEventListener('mouseup', onMouseUp, opts);
    slider.addEventListener('mousemove', onMouseMove, opts);
    slider.addEventListener('click', onClick, true); // Use capture phase to stop inner clicks

    return () => {
      slider.removeEventListener('mousedown', onMouseDown);
      slider.removeEventListener('mouseleave', onMouseLeave);
      slider.removeEventListener('mouseup', onMouseUp);
      slider.removeEventListener('mousemove', onMouseMove);
      slider.removeEventListener('click', onClick, true);
    };
  }, []);

  return (
    <div ref={ref} className={className} style={{ cursor: 'grab' }} {...props}>
      {children}
    </div>
  );
};

export default DraggableContainer;
