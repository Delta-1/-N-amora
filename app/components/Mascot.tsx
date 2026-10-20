export default function Mascot({ small = false, expression = 'happy' }: {
    small?: boolean;
    expression?: string;
}) {
    return <div className={`mascot ${small ? 'small' : ''}`} aria-label="Lilith, nossa mascote amora" role="img"><svg viewBox="0 0 210 230" fill="none" aria-hidden="true">
 <ellipse cx="105" cy="208" rx="54" ry="10" fill="#674353" opacity=".1"/>
 <path d="M74 169Q51 164 47 177Q46 188 73 184M137 169Q161 164 165 177Q166 188 137 184" fill="#bd7099"/>
 <path d="M79 182Q71 209 85 209Q100 210 99 187M115 187Q113 211 128 209Q143 208 134 183" fill="#a55982"/>
 <path d="M49 96C44 65 65 46 91 49C93 28 122 24 134 47C161 39 181 67 169 91C190 109 184 137 166 148C168 175 145 192 122 185C104 204 76 191 70 178C41 178 29 151 43 132C27 117 34 99 49 96Z" fill="#b96f96"/>
 <path d="M49 96C44 65 65 46 91 49C93 28 122 24 134 47C161 39 181 67 169 91C190 109 184 137 166 148C168 175 145 192 122 185C104 204 76 191 70 178C41 178 29 151 43 132C27 117 34 99 49 96Z" fill="url(#berry)"/>
 <path d="M103 48C79 40 74 20 82 15C101 12 112 29 108 44" fill="#7b8f67"/><path d="M108 45C105 24 123 13 140 19C145 35 127 47 108 45" fill="#a3b68c"/><path d="M108 43Q120 27 133 26" stroke="#71875e" strokeWidth="2" strokeLinecap="round"/>
 <ellipse cx="74" cy="126" rx="12" ry="7" fill="#e8a4b6"/><ellipse cx="139" cy="126" rx="12" ry="7" fill="#e8a4b6"/>
 <g className="mascot-eyes">{expression === 'sleepy' ? <><path d="M78 108q8 7 15 0M122 108q8 7 15 0" stroke="#543246" strokeWidth="4" strokeLinecap="round"/></> : <><ellipse cx="87" cy="111" rx="5" ry="7" fill="#543246"/><ellipse cx="128" cy="111" rx="5" ry="7" fill="#543246"/><circle cx="89" cy="109" r="1.5" fill="white"/><circle cx="130" cy="109" r="1.5" fill="white"/></>}</g>
 <path d="M101 127q7 9 14 0" stroke="#6e3c52" strokeWidth="3" strokeLinecap="round"/>
 <path d="M101 158C93 147 80 155 86 165L104 178L121 163C129 151 113 145 105 158" fill="#f5d2cd"/>
 <circle cx="63" cy="74" r="7" fill="#fff" opacity=".15"/>
 <defs><linearGradient id="berry" x1="75" y1="52" x2="147" y2="185" gradientUnits="userSpaceOnUse"><stop stopColor="#c989a9"/><stop offset="1" stopColor="#a95f88"/></linearGradient></defs>
 </svg></div>;
}
