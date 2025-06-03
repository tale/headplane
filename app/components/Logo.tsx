import cn from '~/utils/cn';
import LogoSvg from '../../assets/headplane-logo-light.svg';

export interface LogoProps {
	className?: string;
}

export default function Logo({ className }: LogoProps) {
	return <img alt="Logo" className={cn(className)} src={LogoSvg} />;
}
