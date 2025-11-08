import React from 'react';
import { FaDiscord, FaTwitter, FaYoutube, FaMedium } from 'react-icons/fa';
import { SocialLink } from '../types'; // Adjust the import path if needed

const socialLinks: SocialLink[] = [
  { href: 'https://discord.com', icon: <FaDiscord /> },
  { href: 'https://twitter.com', icon: <FaTwitter /> },
  { href: 'https://youtube.com', icon: <FaYoutube /> },
  { href: 'https://medium.com', icon: <FaMedium /> },
];

const Footer: React.FC = () => {
  return (
    <footer className="w-full max-w-[100vw] bg-[#5542ff] py-6 sm:py-4 text-black">
      <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-4 sm:gap-4 sm:px-4 sm:flex-row">
        <p className="uppercase font-zentry font-black text-sm sm:text-xl text-center sm:text-left">
          ©Pop<b>Q</b>uiz 2025 All rights reserved
        </p>

        <div className="flex justify-center gap-3 sm:gap-4 sm:justify-start">
          {socialLinks.map((link, index) => (
            <a
              key={index}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-black transition-colors text-base sm:text-xl duration-500 ease-in-out hover:text-white"
            >
              {link.icon}
            </a>
          ))}
        </div>

        <a
          href="#privacy-policy"
          className="text-center uppercase font-zentry font-black text-sm sm:text-xl hover:underline sm:text-right"
        >
          Privacy Policy
        </a>
      </div>
    </footer>
  );
};

export default Footer;
