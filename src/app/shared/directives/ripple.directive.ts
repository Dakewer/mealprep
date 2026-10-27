import {
  Directive,
  ElementRef,
  HostListener,
  Renderer2,
  inject,
} from '@angular/core';

/**
 * Directiva de efecto Ripple Material-like.
 * Uso: <button appRipple>Click me</button>
 *
 * La directiva crea un elemento <span> posicionado en el punto
 * de click y lo anima con un scale-out fade, luego lo elimina.
 */
@Directive({
  selector: '[appRipple]',
  standalone: true,
})
export class RippleDirective {
  private el       = inject(ElementRef);
  private renderer = inject(Renderer2);

  constructor() {
    // El host necesita position: relative y overflow: hidden
    this.renderer.setStyle(this.el.nativeElement, 'position', 'relative');
    this.renderer.setStyle(this.el.nativeElement, 'overflow', 'hidden');
  }

  @HostListener('click', ['$event'])
  onClick(event: MouseEvent): void {
    const host = this.el.nativeElement as HTMLElement;
    const rect = host.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 2;
    const x    = event.clientX - rect.left - size / 2;
    const y    = event.clientY - rect.top  - size / 2;

    const ripple = this.renderer.createElement('span') as HTMLElement;

    const styles: Record<string, string> = {
      position:       'absolute',
      width:          `${size}px`,
      height:         `${size}px`,
      left:           `${x}px`,
      top:            `${y}px`,
      borderRadius:   '50%',
      background:     'rgba(255, 255, 255, 0.28)',
      transform:      'scale(0)',
      animation:      'ripple-effect 600ms linear forwards',
      pointerEvents:  'none',
      zIndex:         '999',
    };

    Object.entries(styles).forEach(([prop, val]) =>
      this.renderer.setStyle(ripple, prop, val)
    );

    this.renderer.appendChild(host, ripple);
    setTimeout(() => this.renderer.removeChild(host, ripple), 650);
  }
}
