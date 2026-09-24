import React, { useEffect, useRef } from 'react';

// Mount consumers near the viewport, preserving their state when scrolling back.
export default function DeferredSection({ active, observe, onVisible, children, section }) {
  const ref = useRef(null);
  useEffect(() => {
    if (active || !observe) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      onVisible(section.id);
      return undefined;
    }
    const observer = new IntersectionObserver((entries) => {
      // Also activate passed sections after a hash link or a large scroll jump.
      if (entries.some((entry) => entry.isIntersecting || entry.boundingClientRect.bottom <= 0)) {
        onVisible(section.id);
        observer.disconnect();
      }
    }, { rootMargin: '200px 0px' });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [active, observe, onVisible, section.id]);

  return (
    <div ref={ref} data-storefront-section={section.id} style={{ display: active ? 'contents' : 'block' }}>
      {active ? children : (
        <div aria-hidden="true" style={{ minHeight: section.type === 'header' ? 140 : 360 }} />
      )}
    </div>
  );
}
