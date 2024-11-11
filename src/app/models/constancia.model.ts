export interface Constancia {
    id?: string;
    nombre: string;
    apellidos: string;
    documento: string;
    tipo: string;
    motivo: string;
    estado: string;
    createdAt: string;  // Aseguramos que sea string
    updatedAt: string;
    userId: string;
    userEmail: string;

}