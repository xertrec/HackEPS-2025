// src/mobility/neighborhood.entity.ts
import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('neighborhoods')
export class Neighborhood {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ type: 'float', nullable: true })
  latitude: number;

  @Column({ type: 'float', nullable: true })
  longitude: number;

  // --- NUEVAS COLUMNAS PARA GUARDAR DATOS ---
  
  @Column({ type: 'integer', nullable: true })
  score: number; // Aquí guardaremos la nota (0-100)

  @Column({ type: 'text', nullable: true })
  details: string; // Aquí guardaremos el JSON completo como texto
}