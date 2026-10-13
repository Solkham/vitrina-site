import { createClient } from '@supabase/supabase-js';

// Публичные ключи: доступ ограничен политиками RLS в базе
export const SUPABASE_URL = 'https://ubvutpgzrrpixfuunuot.supabase.co';
export const sb = createClient(SUPABASE_URL, 'sb_publishable_tgSxlMdxlAoj7VujCIQTOw_429UiRst');

export const photoUrl = path => `${SUPABASE_URL}/storage/v1/object/public/product-photos/${path}`;
export const TYPES = { dress: 'Платья', abaya: 'Абайи', blouse: 'Блузки', skirt: 'Юбки', other: 'Другое' };

// Каталог для витрины: активные магазины и товары с первым фото
export async function loadCatalog() {
  const [shops, products] = await Promise.all([
    sb.from('shops').select('id,slug,name,city,note,whatsapp,sort').eq('active', true).order('sort'),
    sb.from('products').select('id,shop_id,type,name,price,color,sizes,is_new,created_at,product_photos(storage_path,sort)').eq('active', true).order('created_at')
  ]);
  if (shops.error) throw shops.error;
  if (products.error) throw products.error;
  return { shops: shops.data, products: products.data };
}
