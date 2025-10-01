// Export the type so it can be imported by other files
export type ButtonProps = {
  id?: string;
  title: string;
  rightIcon?: React.ReactNode;
  leftIcon?: React.ReactNode;
  containerClass?: string;
};

export interface AnimatedTitleProps {
  title: string;
  containerClass?: string;
}

export interface ImageClipBoxProps {
  src: string;
  clipClass: string;
}

export interface BentoTiltProps {
  children: React.ReactNode;
  className?: string;
}

export interface BentoCardProps {
  src: string;
  title: React.ReactNode;
  description?: string;
  isComingSoon?: boolean;
}

export interface SocialLink {
  href: string;
  icon: React.ReactElement;
}
