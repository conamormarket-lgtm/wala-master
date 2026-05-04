import React from 'react';

/**
 * Iconos SVG inline para evitar dependencias externas
 */

export const EyeIcon = ({ size = 20, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <path
      d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M10 3.75C5.833 3.75 2.275 6.342 1 10c1.275 3.658 4.833 6.25 9 6.25s7.725-2.592 9-6.25c-1.275-3.658-4.833-6.25-9-6.25z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const EyeOffIcon = ({ size = 20, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <path
      d="M13.125 13.125L6.875 6.875M8.75 3.75C9.583 3.75 10.417 3.833 11.25 4M15 5.625C16.25 6.875 17.083 8.333 17.5 10M2.5 2.5L17.5 17.5M12.5 12.5C11.667 13.333 10.833 13.75 10 13.75C7.5 13.75 5.625 11.875 5.625 9.375C5.625 8.542 6.042 7.708 6.875 6.875M3.75 5C2.5 6.25 1.667 7.708 1.25 9.375"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const EditIcon = ({ size = 18, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <path
      d="M11.667 4.167l4.166 4.166M2.5 17.5h4.167L15.833 10l-4.166-4.167L2.5 13.333v4.167z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const TrashIcon = ({ size = 18, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <path
      d="M2.5 5h15M8.333 8.333v5M11.667 8.333v5M4.167 5l.833 10c0 .917.75 1.667 1.667 1.667h5.666c.917 0 1.667-.75 1.667-1.667l.833-10M7.5 5V3.333c0-.917.75-1.667 1.667-1.667h1.666c.917 0 1.667.75 1.667 1.667V5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const GridIcon = ({ size = 20, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <rect x="2.5" y="2.5" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
    <rect x="11.5" y="2.5" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
    <rect x="2.5" y="11.5" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
    <rect x="11.5" y="11.5" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

export const TableIcon = ({ size = 20, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <path
      d="M2.5 3.333h15c.917 0 1.667.75 1.667 1.667v10c0 .917-.75 1.667-1.667 1.667h-15c-.917 0-1.667-.75-1.667-1.667V5c0-.917.75-1.667 1.667-1.667zM2.5 10h15M10 3.333V16.667"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const CopyIcon = ({ size = 18, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <path
      d="M13.333 10V4.167c0-.917-.75-1.667-1.666-1.667H4.167c-.917 0-1.667.75-1.667 1.667v7.5c0 .917.75 1.667 1.667 1.667H10M13.333 10h2.5c.917 0 1.667.75 1.667 1.667v7.5c0 .917-.75 1.667-1.667 1.667h-7.5c-.917 0-1.667-.75-1.667-1.667V10"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
