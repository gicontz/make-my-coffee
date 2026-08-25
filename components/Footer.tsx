import Link from 'next/link'
import Image from 'next/image'
import wordmark from '@/app/assets/logo-wordmark.png'

export default function Footer() {
  return (
    <footer className="bg-espresso-900 text-espresso-300 border-t border-espresso-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          <div>
            <Image
              src={wordmark}
              alt="Make My Coffee"
              className="h-9 w-auto brightness-0 invert mb-4"
            />
            <p className="text-espresso-400 text-sm leading-relaxed">
              Pure espresso shots crafted for those who love their coffee their own way. A signature blend from Cambodia &amp; Indonesia.
            </p>
          </div>
          <div>
            <h4 className="text-espresso-200 font-semibold text-xs tracking-widest uppercase mb-3">Quick Links</h4>
            <ul className="space-y-2">
              {[['/', 'Home'], ['/shop', 'Shop'], ['/cart', 'Cart']].map(([href, label]) => (
                <li key={href}>
                  <Link href={href} className="text-espresso-400 hover:text-espresso-300 text-sm transition-colors">{label}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-espresso-200 font-semibold text-xs tracking-widest uppercase mb-3">The Bean</h4>
            <p className="text-espresso-400 text-sm leading-relaxed">
              Aconchego — "comfort" in Portuguese. A signature blend that brings warmth and depth to every cup you craft.
            </p>
          </div>
        </div>
        <div className="border-t border-espresso-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-espresso-600 text-xs">© {new Date().getFullYear()} Make My Coffee. All rights reserved.</p>
          <p className="text-espresso-700 text-xs">Aconchego · Signature Blend · Cambodia × Indonesia</p>
        </div>
      </div>
    </footer>
  )
}
