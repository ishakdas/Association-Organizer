'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PhoneInput } from '@/components/ui/phone-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { requestBranchRegistration } from '@/lib/api/auth';
import { getProvinceNames, getDistricts } from '@/lib/turkey-locations';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function CreateRegistrationDialog({ open, onOpenChange, onCreated }: Props) {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const provinces = useMemo(() => getProvinceNames(), []);
  const districts = useMemo(() => (city ? getDistricts(city) : []), [city]);

  function reset() {
    setEmail('');
    setFullName('');
    setPhone('');
    setCity('');
    setDistrict('');
    setMessage('');
  }

  function handleClose(next: boolean) {
    if (loading) return;
    if (!next) reset();
    onOpenChange(next);
  }

  function handleCityChange(next: string) {
    setCity(next);
    setDistrict('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !fullName || !city || !district) {
      toast.error('Zorunlu alanları doldurun');
      return;
    }
    setLoading(true);
    try {
      await requestBranchRegistration({
        email,
        fullName,
        phone: phone ? `+90${phone}` : undefined,
        city,
        district,
        message: message || undefined,
      });
      toast.success('Başvuru oluşturuldu — onaylamak için Bekleyen sekmesine bakın.');
      reset();
      onCreated();
      onOpenChange(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Başvuru oluşturulamadı.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Yeni Şube Başvurusu Oluştur</DialogTitle>
          <DialogDescription>
            Genel Başkan adına manuel başvuru oluşturur. Onaylandığında kullanıcıya
            davet e-postası gönderilir.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="cr-email">
              E-posta <span className="text-destructive">*</span>
            </Label>
            <Input
              id="cr-email"
              type="email"
              autoComplete="email"
              placeholder="ornek@dernek.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cr-fullname">
              Başkan Ad Soyad <span className="text-destructive">*</span>
            </Label>
            <Input
              id="cr-fullname"
              type="text"
              autoComplete="name"
              placeholder="Ali Veli"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="space-y-1.5">
            <Label>
              İl <span className="text-destructive">*</span>
            </Label>
            <Select value={city} onValueChange={handleCityChange} disabled={loading}>
              <SelectTrigger>
                <SelectValue placeholder="İl seçiniz..." />
              </SelectTrigger>
              <SelectContent>
                {provinces.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>
              İlçe <span className="text-destructive">*</span>
            </Label>
            <Select
              value={district}
              onValueChange={setDistrict}
              disabled={loading || !city}
            >
              <SelectTrigger>
                <SelectValue placeholder={city ? 'İlçe seçiniz...' : 'Önce il seçiniz'} />
              </SelectTrigger>
              <SelectContent>
                {districts.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cr-phone">
              İletişim <span className="text-muted-foreground">(opsiyonel)</span>
            </Label>
            <PhoneInput
              id="cr-phone"
              value={phone}
              onChange={setPhone}
              disabled={loading}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cr-message">
              Not <span className="text-muted-foreground">(opsiyonel)</span>
            </Label>
            <Textarea
              id="cr-message"
              placeholder="Başvuruyla ilgili notlar..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={loading}
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClose(false)}
              disabled={loading}
            >
              İptal
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Oluşturuluyor...
                </>
              ) : (
                'Oluştur'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
