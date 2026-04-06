import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { FusedPill } from '../ui/FusedPill';
import { User } from 'lucide-react';

export const AdminUsersTab = () => {
  const [users, setUsers] = useState<any[]>([]);

  // Simulating fetching users since Supabase Auth requires an Edge Function or admin client to list users securely
  // In a real scenario, this fetches from a `user_profiles` or `employees` public table
  useEffect(() => {
    setUsers([
      { id: '1', role: 'vendedor', name: 'Carlos Pérez', status: 'Activo' },
      { id: '2', role: 'dejador', name: 'Miguel Ángel', status: 'En Ruta' },
      { id: '3', role: 'vendedor', name: 'Ana Gómez', status: 'Inactivo' },
    ]);
  }, []);

  const getRoleColor = (role: string) => {
    switch(role) {
      case 'vendedor': return 'bg-frita-red';
      case 'dejador': return 'bg-frita-orange';
      case 'admin': return 'bg-gray-800';
      default: return 'bg-gray-400';
    }
  };

  return (
    <div className="p-4 bg-gray-50 flex-1">
      <h2 className="text-2xl font-black text-gray-800 mb-6">Personal Activo</h2>

      <div className="flex flex-col gap-2">
        {users.map((u) => (
          <FusedPill 
            key={u.id}
            title={u.role.toUpperCase()}
            value={`${u.name} • ${u.status}`}
            leftColor={getRoleColor(u.role)}
            icon={<User size={24} />}
          />
        ))}
      </div>
    </div>
  );
};
