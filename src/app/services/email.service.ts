import { Injectable } from '@angular/core';
import { Constancia } from '../models/constancia.model';
import emailjs from '@emailjs/browser';
import { UtilsService } from './utils.service';
import { getStorage, ref, uploadString, getDownloadURL, deleteObject } from 'firebase/storage';
import { environment } from 'src/environments/environment';

@Injectable({
    providedIn: 'root'
})
export class EmailService {
    private readonly EMAIL_PUBLIC_KEY = 'OKuL_TwoMqs5Uvk_w';
    private readonly EMAIL_SERVICE_ID = 'service_3qnkqtj';
    private readonly EMAIL_TEMPLATE_ID = 'template_oitdhps';
    private readonly PDF_EXPIRY_TIME = 3600000; // 1 hora en milisegundos

    constructor(private utilsSvc: UtilsService) { }

    async sendStatusUpdateEmail(constancia: Constancia, newStatus: string, pdfBase64?: string): Promise<void> {
        return Promise.resolve();
    }

    // async sendStatusUpdateEmail(constancia: Constancia, newStatus: string, pdfBase64?: string): Promise<void> {
    //     let pdfUrl = '';
    //     let pdfPath = '';

    //     try {
    //         let messageHtml: string;

    //         // Si es aprobada y tiene PDF, primero subir el PDF
    //         if (newStatus === 'aprobada' && pdfBase64) {
    //             const uploadResult = await this.uploadPDFToStorage(constancia, pdfBase64);
    //             pdfUrl = uploadResult.url;
    //             pdfPath = uploadResult.path;
    //             messageHtml = await this.createEmailBody(constancia, pdfUrl);
    //         } else {
    //             // Para otros estados, generar el contenido correspondiente
    //             switch (newStatus) {
    //                 case 'aprobada':
    //                     messageHtml = await this.createApprovedEmailBody(constancia);
    //                     break;
    //                 case 'rechazada':
    //                     messageHtml = await this.createRejectedEmailBody(constancia);
    //                     break;
    //                 case 'pendiente':
    //                     messageHtml = await this.createPendingEmailBody(constancia);
    //                     break;
    //                 default:
    //                     throw new Error('Estado no válido');
    //             }
    //         }

    //         // Parámetros que coinciden exactamente con la plantilla de EmailJS
    //         const templateParams = {
    //             to_email: constancia.userEmail,
    //             to_name: `${constancia.nombre} ${constancia.apellidos}`,
    //             subject: `Estado de Constancia: ${this.getStatusLabel(newStatus)}`,
    //             message_html: messageHtml, // Asegúrate que este nombre coincida con la plantilla
    //             tipo_constancia: constancia.tipo,
    //             documento: constancia.documento,
    //             fecha: new Date().toLocaleDateString(),
    //             motivo: constancia.motivo
    //         };

    //         console.log('Enviando email con parámetros:', {
    //             ...templateParams,
    //             to_email: '***HIDDEN***'
    //         });

    //         const response = await emailjs.send(
    //             this.EMAIL_SERVICE_ID,
    //             this.EMAIL_TEMPLATE_ID,
    //             templateParams
    //         );

    //         if (response.status === 200) {
    //             if (pdfPath) {
    //                 this.schedulePDFCleanup(pdfPath);
    //             }

    //             this.utilsSvc.presentToast({
    //                 message: 'Notificación enviada al correo electrónico',
    //                 duration: 2500,
    //                 color: 'success',
    //                 position: 'middle'
    //             });
    //         } else {
    //             throw new Error('Error al enviar el email');
    //         }

    //     } catch (error) {
    //         console.error('Error en el proceso de envío:', error);
    //         if (pdfPath) {
    //             await this.deletePDFFromStorage(pdfPath).catch(console.error);
    //         }
    //         this.utilsSvc.presentToast({
    //             message: 'Error al enviar la notificación por correo',
    //             duration: 2500,
    //             color: 'danger',
    //             position: 'middle'
    //         });
    //         throw error;
    //     }
    // }

    private getStatusLabel(status: string): string {
        switch (status) {
            case 'aprobada':
                return 'Aprobada';
            case 'rechazada':
                return 'No Aprobada';
            case 'pendiente':
                return 'En Revisión';
            default:
                return status.charAt(0).toUpperCase() + status.slice(1);
        }
    }

    private async uploadPDFToStorage(constancia: Constancia, pdfBase64: string): Promise<{ url: string, path: string }> {
        try {
            const storage = getStorage();
            const timestamp = new Date().getTime();
            const pdfPath = `temp_pdfs/${constancia.documento}_${timestamp}.pdf`;
            const storageRef = ref(storage, pdfPath);

            const pdfFormatted = pdfBase64.startsWith('data:application/pdf;base64,')
                ? pdfBase64
                : `data:application/pdf;base64,${pdfBase64}`;

            await uploadString(storageRef, pdfFormatted, 'data_url');
            const url = await getDownloadURL(storageRef);

            return { url, path: pdfPath };
        } catch (error) {
            console.error('Error al subir PDF:', error);
            throw new Error('Error al subir el archivo PDF');
        }
    }

    private async deletePDFFromStorage(pdfPath: string): Promise<void> {
        try {
            const storage = getStorage();
            const fileRef = ref(storage, pdfPath);
            await deleteObject(fileRef);
            console.log('PDF temporal eliminado:', pdfPath);
        } catch (error) {
            console.error('Error al eliminar PDF temporal:', error);
            throw error;
        }
    }

    private schedulePDFCleanup(pdfPath: string): void {
        setTimeout(async () => {
            try {
                await this.deletePDFFromStorage(pdfPath);
            } catch (error) {
                console.error('Error en limpieza programada del PDF:', error);
            }
        }, this.PDF_EXPIRY_TIME);
    }



    private async createEmailBody(constancia: Constancia, pdfUrl: string): Promise<string> {
        return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
                <h2 style="color: #2c3e50; text-align: center;">Constancia Aprobada</h2>
                <div style="background-color: white; padding: 20px; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <p style="color: #34495e;">Estimado/a ${constancia.nombre} ${constancia.apellidos},</p>
                    <p style="color: #34495e;">Su constancia ha sido aprobada con los siguientes detalles:</p>
                    <ul style="color: #34495e;">
                        <li><strong>Tipo:</strong> ${constancia.tipo}</li>
                        <li><strong>Documento:</strong> ${constancia.documento}</li>
                        <li><strong>Fecha:</strong> ${new Date().toLocaleDateString()}</li>
                        <li><strong>Motivo:</strong> ${constancia.motivo}</li>
                    </ul>
                    <div style="text-align: center; margin: 20px 0;">
                        <a href="${pdfUrl}" 
                           target="_blank"
                           style="background-color: #3498db; color: white; padding: 10px 20px; 
                                  text-decoration: none; border-radius: 5px; display: inline-block;">
                            Descargar Constancia
                        </a>
                    </div>
                    <p style="color: #7f8c8d; font-size: 12px; text-align: center;">
                        Este enlace estará disponible por 1 hora.
                    </p>
                    <hr style="border: 1px solid #eee; margin: 20px 0;">
                    <p style="color: #34495e;">Saludos cordiales,<br>El equipo de administración</p>
                </div>
            </div>
        `;
    }

    private async createApprovedEmailBody(constancia: Constancia): Promise<string> {
        return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
                <h2 style="color: #2c3e50; text-align: center;">Constancia Aprobada</h2>
                <div style="background-color: white; padding: 20px; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <p style="color: #34495e;">Estimado/a ${constancia.nombre} ${constancia.apellidos},</p>
                    <p style="color: #34495e;">Su constancia ha sido aprobada con los siguientes detalles:</p>
                    <ul style="color: #34495e;">
                        <li><strong>Tipo:</strong> ${constancia.tipo}</li>
                        <li><strong>Documento:</strong> ${constancia.documento}</li>
                        <li><strong>Fecha:</strong> ${new Date().toLocaleDateString()}</li>
                        <li><strong>Motivo:</strong> ${constancia.motivo}</li>
                    </ul>
                    <hr style="border: 1px solid #eee; margin: 20px 0;">
                    <p style="color: #34495e;">Saludos cordiales,<br>El equipo de administración</p>
                </div>
            </div>
        `;
    }

    private async createRejectedEmailBody(constancia: Constancia): Promise<string> {
        return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
                <h2 style="color: #e74c3c; text-align: center;">Constancia No Aprobada</h2>
                <div style="background-color: white; padding: 20px; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <p style="color: #34495e;">Estimado/a ${constancia.nombre} ${constancia.apellidos},</p>
                    <p style="color: #34495e;">Lamentamos informarle que su solicitud de constancia ha sido rechazada.</p>
                    <ul style="color: #34495e;">
                        <li><strong>Tipo:</strong> ${constancia.tipo}</li>
                        <li><strong>Documento:</strong> ${constancia.documento}</li>
                        <li><strong>Fecha de revisión:</strong> ${new Date().toLocaleDateString()}</li>
                        <li><strong>Motivo registrado:</strong> ${constancia.motivo}</li>
                    </ul>
                    <p style="color: #34495e;">Por favor, revise los requisitos y la información proporcionada. 
                    Si tiene alguna duda, puede contactar con el departamento administrativo.</p>
                    <hr style="border: 1px solid #eee; margin: 20px 0;">
                    <p style="color: #34495e;">Saludos cordiales,<br>El equipo de administración</p>
                </div>
            </div>
        `;
    }

    private async createPendingEmailBody(constancia: Constancia): Promise<string> {
        return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
                <h2 style="color: #f39c12; text-align: center;">Constancia en Revisión</h2>
                <div style="background-color: white; padding: 20px; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <p style="color: #34495e;">Estimado/a ${constancia.nombre} ${constancia.apellidos},</p>
                    <p style="color: #34495e;">Su solicitud de constancia está siendo revisada por nuestro equipo.</p>
                    <ul style="color: #34495e;">
                        <li><strong>Tipo:</strong> ${constancia.tipo}</li>
                        <li><strong>Documento:</strong> ${constancia.documento}</li>
                        <li><strong>Fecha de solicitud:</strong> ${new Date().toLocaleDateString()}</li>
                        <li><strong>Motivo:</strong> ${constancia.motivo}</li>
                    </ul>
                    <p style="color: #34495e;">Le notificaremos cuando se complete la revisión de su solicitud.</p>
                    <hr style="border: 1px solid #eee; margin: 20px 0;">
                    <p style="color: #34495e;">Saludos cordiales,<br>El equipo de administración</p>
                </div>
            </div>
        `;
    }

}