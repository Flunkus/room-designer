/* ===== Icons — stroke line set, 24x24, currentColor ===== */
(function () {
  const P = {
    select:   <><path d="M5 3l5.5 13 2-5 5-2L5 3z"/></>,
    pen:      <><path d="M5 19l2.5-.5L18 8l-2-2L5.5 16.5 5 19z"/><path d="M14.5 6.5l3 3"/></>,
    hand:     <><path d="M8 11V5.5a1.5 1.5 0 013 0V11"/><path d="M11 11V4.5a1.5 1.5 0 013 0V11"/><path d="M14 11V6a1.5 1.5 0 013 0v7a6 6 0 01-6 6h-1.2a5 5 0 01-3.6-1.6L4 14.5a1.6 1.6 0 012.4-2.1L8 14"/></>,
    rect:     <><rect x="4" y="6" width="16" height="12" rx="1.5"/></>,
    ruler:    <><rect x="3" y="8" width="18" height="8" rx="1" transform="rotate(-45 12 12)"/><path d="M9 7.5l1.2 1.2M11.5 5l1.2 1.2M6.5 10l1.2 1.2"/></>,
    sofa:     <><path d="M5 11V8.5A1.5 1.5 0 016.5 7h11A1.5 1.5 0 0119 8.5V11"/><path d="M3.5 11.5A1.5 1.5 0 015 13v3h14v-3a1.5 1.5 0 113 0V17a1 1 0 01-1 1H3a1 1 0 01-1-1v-4a1.5 1.5 0 011.5-1.5z"/><path d="M5 16v2M19 16v2"/></>,
    swatch:   <><rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/></>,
    layers:   <><path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/></>,
    eye:      <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="2.5"/></>,
    eyeOff:   <><path d="M4 4l16 16"/><path d="M9.5 5.4A9.8 9.8 0 0112 5c6.5 0 10 7 10 7a17 17 0 01-3 3.6M6.2 7.2A17 17 0 002 12s3.5 7 10 7a9.6 9.6 0 004.3-1"/></>,
    lock:     <><rect x="5" y="11" width="14" height="9" rx="1.5"/><path d="M8 11V8a4 4 0 018 0v3"/></>,
    trash:    <><path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13"/></>,
    plus:     <><path d="M12 5v14M5 12h14"/></>,
    sparkle:  <><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z"/><path d="M19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2z"/></>,
    upload:   <><path d="M12 16V5M8 9l4-4 4 4"/><path d="M5 16v2a1 1 0 001 1h12a1 1 0 001-1v-2"/></>,
    image:    <><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.6"/><path d="M21 16l-5-5L5 20"/></>,
    box:      <><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/></>,
    search:   <><circle cx="11" cy="11" r="6"/><path d="M20 20l-3.5-3.5"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 13.5a7.9 7.9 0 000-3l1.6-1.2-1.5-2.6-1.9.7a7.6 7.6 0 00-2.6-1.5L14.2 4h-3l-.3 1.9a7.6 7.6 0 00-2.6 1.5l-1.9-.7L4.9 9.3 6.5 10.5a7.9 7.9 0 000 3L4.9 14.7l1.5 2.6 1.9-.7a7.6 7.6 0 002.6 1.5l.3 1.9h3l.3-1.9a7.6 7.6 0 002.6-1.5l1.9.7 1.5-2.6-1.6-1.2z"/></>,
    undo:     <><path d="M9 7L4 12l5 5"/><path d="M4 12h11a5 5 0 010 10h-1"/></>,
    redo:     <><path d="M15 7l5 5-5 5"/><path d="M20 12H9a5 5 0 000 10h1"/></>,
    plan2d:   <><rect x="3" y="3" width="18" height="18" rx="1.5"/><path d="M3 9h10M13 3v18M13 15h8"/></>,
    cube3d:   <><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/></>,
    walk:     <><circle cx="13" cy="4.5" r="1.6"/><path d="M13 8l-3 4 2 2 1 6M13 12l3 2 3-1M10 12l-2 5"/></>,
    orbit:    <><circle cx="12" cy="12" r="3"/><ellipse cx="12" cy="12" rx="10" ry="4.2"/></>,
    grid:     <><rect x="3" y="3" width="18" height="18" rx="1.5"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></>,
    chevron:  <><path d="M9 6l6 6-6 6"/></>,
    chevD:    <><path d="M6 9l6 6 6-6"/></>,
    close:    <><path d="M6 6l12 12M18 6L6 18"/></>,
    check:    <><path d="M5 12l5 5L19 7"/></>,
    copy:     <><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a1 1 0 01-1-1V4a1 1 0 011-1h10a1 1 0 011 1v1"/></>,
    drag:     <><circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/></>,
    warn:     <><path d="M12 4l9 16H3l9-16z"/><path d="M12 10v4M12 17.5v.5"/></>,
    person:   <><circle cx="12" cy="6" r="2.4"/><path d="M12 9v7M12 16l-3 5M12 16l3 5M7 12h10"/></>,
    clearance:<><rect x="7" y="7" width="10" height="10" rx="1"/><rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="3 3"/></>,
    plant:    <><path d="M12 21V11"/><path d="M12 11c0-3-2-5-5-5 0 3 2 5 5 5zM12 11c0-4 2.5-6 6-6 0 4-2.5 6-6 6z"/><path d="M9 21h6"/></>,
    tv:       <><rect x="3" y="5" width="18" height="11" rx="1.5"/><path d="M8 20h8M12 16v4"/></>,
    bed:      <><path d="M3 17V9a1 1 0 011-1h16a1 1 0 011 1v8M3 13h18M3 17v2M21 17v2"/><path d="M7 8V6.5A1.5 1.5 0 018.5 5h7A1.5 1.5 0 0117 6.5V8"/></>,
    desk:     <><path d="M3 7h18M5 7v12M19 7v12M5 12h14"/></>,
    chair:    <><path d="M7 4v8h10V4M7 12v8M17 12v8M5 12h14M9 20h6"/></>,
    storage:  <><rect x="4" y="4" width="16" height="16" rx="1.5"/><path d="M4 12h16M12 8v.5M12 15v.5"/></>,
    lamp:     <><path d="M9 4h6l2 6H7l2-6z"/><path d="M12 10v9M9 19h6"/></>,
    table:    <><path d="M4 9h16M6 9v10M18 9v10M4 9l2-4h12l2 4"/></>,
    rug:      <><rect x="4" y="6" width="16" height="12" rx="1"/><path d="M4 9h16M4 15h16"/></>,
    target:   <><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></>,
    zoomIn:   <><circle cx="11" cy="11" r="6"/><path d="M20 20l-3.5-3.5M11 9v4M9 11h4"/></>,
    zoomOut:  <><circle cx="11" cy="11" r="6"/><path d="M20 20l-3.5-3.5M9 11h4"/></>,
    fit:      <><path d="M4 9V5a1 1 0 011-1h4M15 4h4a1 1 0 011 1v4M20 15v4a1 1 0 01-1 1h-4M9 20H5a1 1 0 01-1-1v-4"/></>,
    link:     <><path d="M10 14a4 4 0 005.6 0l2.4-2.4a4 4 0 10-5.6-5.6L11 7.4"/><path d="M14 10a4 4 0 00-5.6 0L6 12.4a4 4 0 105.6 5.6L13 16.6"/></>,
    folder:   <><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/></>,
    save:     <><path d="M5 3h11l3 3v13a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z"/><path d="M8 3v5h7M8 14h8v6H8z"/></>,
  };

  function Icon({ name, size }) {
    const d = P[name] || P.box;
    return (
      <svg viewBox="0 0 24 24" width={size || 20} height={size || 20}
        fill="none" stroke="currentColor" strokeWidth="1.6"
        strokeLinecap="round" strokeLinejoin="round">
        {d}
      </svg>
    );
  }

  const TYPE_ICON = {
    sofa: "sofa", chair: "chair", table: "table", storage: "storage",
    tv: "tv", plant: "plant", lamp: "lamp", bed: "bed", desk: "desk", rug: "rug",
  };

  Object.assign(window, { Icon, TYPE_ICON });
})();
