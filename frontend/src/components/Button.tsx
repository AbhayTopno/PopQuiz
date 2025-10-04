import clsx from 'clsx';
import React from 'react';
// Import the ButtonProps type from your dedicated types file
import { ButtonProps } from '@/types'; // Using a path alias like '@/' is common

const Button: React.FC<ButtonProps> = ({
  id,
  title,
  rightIcon,
  leftIcon,
  containerClass,
  onClick, // 1. Added onClick to the destructured props
}) => {
  return (
    <button
      id={id}
      onClick={onClick} // 2. Passed the onClick handler to the button element
      className={clsx(
        'group relative z-10 flex w-fit cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-full bg-violet-50 px-7 py-3 text-black',
        containerClass
      )}
    >
      {leftIcon}

      <span className="relative inline-flex overflow-hidden font-general text-xs uppercase">
        <div className="translate-y-0 skew-y-0 transition duration-500 group-hover:-translate-y-[160%] group-hover:skew-y-12">
          {title}
        </div>
        <div className="absolute translate-y-[164%] skew-y-12 transition duration-500 group-hover:translate-y-0 group-hover:skew-y-0">
          {title}
        </div>
      </span>

      {rightIcon}
    </button>
  );
};

export default Button;
