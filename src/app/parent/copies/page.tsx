import { redirect } from 'next/navigation';
// Ancienne adresse : les copies sont désormais dans « À faire »
export default function Copies() { redirect('/parent/a-faire'); }
