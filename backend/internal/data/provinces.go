package data

// ProvinceCoordinate - İl merkez koordinatı
type ProvinceCoordinate struct {
	Name      string
	Latitude  float64
	Longitude float64
}

// TurkeyProvinces - Türkiye'nin 81 il merkez koordinatları
var TurkeyProvinces = map[string]ProvinceCoordinate{
	"Adana":          {Name: "Adana", Latitude: 37.0000, Longitude: 35.3213},
	"Adıyaman":       {Name: "Adıyaman", Latitude: 37.7648, Longitude: 38.2786},
	"Afyonkarahisar": {Name: "Afyonkarahisar", Latitude: 38.7507, Longitude: 30.5567},
	"Ağrı":           {Name: "Ağrı", Latitude: 39.7191, Longitude: 43.0503},
	"Aksaray":        {Name: "Aksaray", Latitude: 38.3687, Longitude: 34.0370},
	"Amasya":         {Name: "Amasya", Latitude: 40.6499, Longitude: 35.8353},
	"Ankara":         {Name: "Ankara", Latitude: 39.9334, Longitude: 32.8597},
	"Antalya":        {Name: "Antalya", Latitude: 36.8969, Longitude: 30.7133},
	"Ardahan":        {Name: "Ardahan", Latitude: 41.1105, Longitude: 42.7022},
	"Artvin":         {Name: "Artvin", Latitude: 41.1828, Longitude: 41.8183},
	"Aydın":          {Name: "Aydın", Latitude: 37.8560, Longitude: 27.8416},
	"Balıkesir":      {Name: "Balıkesir", Latitude: 39.6484, Longitude: 27.8826},
	"Bartın":         {Name: "Bartın", Latitude: 41.6344, Longitude: 32.3375},
	"Batman":         {Name: "Batman", Latitude: 37.8812, Longitude: 41.1351},
	"Bayburt":        {Name: "Bayburt", Latitude: 40.2552, Longitude: 40.2249},
	"Bilecik":        {Name: "Bilecik", Latitude: 40.0567, Longitude: 30.0665},
	"Bingöl":         {Name: "Bingöl", Latitude: 38.8854, Longitude: 40.4966},
	"Bitlis":         {Name: "Bitlis", Latitude: 38.4006, Longitude: 42.1095},
	"Bolu":           {Name: "Bolu", Latitude: 40.7392, Longitude: 31.6089},
	"Burdur":         {Name: "Burdur", Latitude: 37.7203, Longitude: 30.2906},
	"Bursa":          {Name: "Bursa", Latitude: 40.1826, Longitude: 29.0665},
	"Çanakkale":      {Name: "Çanakkale", Latitude: 40.1553, Longitude: 26.4142},
	"Çankırı":        {Name: "Çankırı", Latitude: 40.6013, Longitude: 33.6134},
	"Çorum":          {Name: "Çorum", Latitude: 40.5506, Longitude: 34.9556},
	"Denizli":        {Name: "Denizli", Latitude: 37.7765, Longitude: 29.0864},
	"Diyarbakır":     {Name: "Diyarbakır", Latitude: 37.9144, Longitude: 40.2306},
	"Düzce":          {Name: "Düzce", Latitude: 40.8438, Longitude: 31.1565},
	"Edirne":         {Name: "Edirne", Latitude: 41.6818, Longitude: 26.5623},
	"Elazığ":         {Name: "Elazığ", Latitude: 38.6810, Longitude: 39.2264},
	"Erzincan":       {Name: "Erzincan", Latitude: 39.7500, Longitude: 39.5000},
	"Erzurum":        {Name: "Erzurum", Latitude: 39.9000, Longitude: 41.2700},
	"Eskişehir":      {Name: "Eskişehir", Latitude: 39.7767, Longitude: 30.5206},
	"Gaziantep":      {Name: "Gaziantep", Latitude: 37.0662, Longitude: 37.3833},
	"Giresun":        {Name: "Giresun", Latitude: 40.9128, Longitude: 38.3895},
	"Gümüşhane":      {Name: "Gümüşhane", Latitude: 40.4386, Longitude: 39.5086},
	"Hakkari":        {Name: "Hakkari", Latitude: 37.5833, Longitude: 43.7333},
	"Hatay":          {Name: "Hatay", Latitude: 36.4018, Longitude: 36.3498},
	"Iğdır":          {Name: "Iğdır", Latitude: 39.9237, Longitude: 44.0450},
	"Isparta":        {Name: "Isparta", Latitude: 37.7648, Longitude: 30.5566},
	"İstanbul":       {Name: "İstanbul", Latitude: 41.0082, Longitude: 29.0121},
	"İzmir":          {Name: "İzmir", Latitude: 38.4237, Longitude: 27.1428},
	"Kahramanmaraş":  {Name: "Kahramanmaraş", Latitude: 37.5858, Longitude: 36.9371},
	"Karabük":        {Name: "Karabük", Latitude: 41.2061, Longitude: 32.6204},
	"Karaman":        {Name: "Karaman", Latitude: 37.1759, Longitude: 33.2287},
	"Kars":           {Name: "Kars", Latitude: 40.6167, Longitude: 43.1000},
	"Kastamonu":      {Name: "Kastamonu", Latitude: 41.3887, Longitude: 33.7827},
	"Kayseri":        {Name: "Kayseri", Latitude: 38.7312, Longitude: 35.4787},
	"Kırıkkale":      {Name: "Kırıkkale", Latitude: 39.8468, Longitude: 33.5153},
	"Kırklareli":     {Name: "Kırklareli", Latitude: 41.7333, Longitude: 27.2167},
	"Kırşehir":       {Name: "Kırşehir", Latitude: 39.1425, Longitude: 34.1709},
	"Kilis":          {Name: "Kilis", Latitude: 36.7184, Longitude: 37.1212},
	"Kocaeli":        {Name: "Kocaeli", Latitude: 40.8533, Longitude: 29.8815},
	"Konya":          {Name: "Konya", Latitude: 37.8746, Longitude: 32.4932},
	"Kütahya":        {Name: "Kütahya", Latitude: 39.4167, Longitude: 29.9833},
	"Malatya":        {Name: "Malatya", Latitude: 38.3552, Longitude: 38.3095},
	"Manisa":         {Name: "Manisa", Latitude: 38.6191, Longitude: 27.4289},
	"Mardin":         {Name: "Mardin", Latitude: 37.3212, Longitude: 40.7245},
	"Mersin":         {Name: "Mersin", Latitude: 36.8000, Longitude: 34.6333},
	"Muğla":          {Name: "Muğla", Latitude: 37.2153, Longitude: 28.3636},
	"Muş":            {Name: "Muş", Latitude: 38.9462, Longitude: 41.7539},
	"Nevşehir":       {Name: "Nevşehir", Latitude: 38.6939, Longitude: 34.6857},
	"Niğde":          {Name: "Niğde", Latitude: 37.9667, Longitude: 34.6833},
	"Ordu":           {Name: "Ordu", Latitude: 40.9839, Longitude: 37.8764},
	"Osmaniye":       {Name: "Osmaniye", Latitude: 37.0742, Longitude: 36.2472},
	"Rize":           {Name: "Rize", Latitude: 41.0201, Longitude: 40.5234},
	"Sakarya":        {Name: "Sakarya", Latitude: 40.6940, Longitude: 30.4358},
	"Samsun":         {Name: "Samsun", Latitude: 41.2867, Longitude: 36.33},
	"Siirt":          {Name: "Siirt", Latitude: 37.9333, Longitude: 41.9500},
	"Sinop":          {Name: "Sinop", Latitude: 42.0231, Longitude: 35.1531},
	"Sivas":          {Name: "Sivas", Latitude: 39.7477, Longitude: 37.0179},
	"Şanlıurfa":      {Name: "Şanlıurfa", Latitude: 37.1591, Longitude: 38.7969},
	"Şırnak":         {Name: "Şırnak", Latitude: 37.5164, Longitude: 42.4611},
	"Tekirdağ":       {Name: "Tekirdağ", Latitude: 40.9833, Longitude: 27.5167},
	"Tokat":          {Name: "Tokat", Latitude: 40.3167, Longitude: 36.5500},
	"Trabzon":        {Name: "Trabzon", Latitude: 41.0015, Longitude: 39.7178},
	"Tunceli":        {Name: "Tunceli", Latitude: 39.1079, Longitude: 39.5401},
	"Uşak":           {Name: "Uşak", Latitude: 38.6823, Longitude: 29.4082},
	"Van":            {Name: "Van", Latitude: 38.4891, Longitude: 43.4089},
	"Yalova":         {Name: "Yalova", Latitude: 40.6500, Longitude: 29.2667},
	"Yozgat":         {Name: "Yozgat", Latitude: 39.8181, Longitude: 34.8147},
	"Zonguldak":      {Name: "Zonguldak", Latitude: 41.4564, Longitude: 31.7987},
}

// GetProvinceCoordinate - İl adına göre koordinat döndür
func GetProvinceCoordinate(name string) (ProvinceCoordinate, bool) {
	coord, exists := TurkeyProvinces[name]
	return coord, exists
}

// NormalizeProvinceName - İl adını normalize et (alternatif yazımları düzelt)
func NormalizeProvinceName(name string) string {
	// Yaygın alternatif yazımları düzelt
	alternatives := map[string]string{
		"Istanbul":        "İstanbul",
		"Izmir":           "İzmir",
		"Sanliurfa":       "Şanlıurfa",
		"Sirnak":          "Şırnak",
		"Canakkale":       "Çanakkale",
		"Cankiri":         "Çankırı",
		"Corum":           "Çorum",
		"Afyon":           "Afyonkarahisar",
		"K.Maras":         "Kahramanmaraş",
		"Kahramanmaras":   "Kahramanmaraş",
		"Agri":            "Ağrı",
		"Aydin":           "Aydın",
		"Balikesir":       "Balıkesir",
		"Bartin":          "Bartın",
		"Bingol":          "Bingöl",
		"Duzce":           "Düzce",
		"Elazig":          "Elazığ",
		"Gumushane":       "Gümüşhane",
		"Igdir":           "Iğdır",
		"Karabuk":         "Karabük",
		"Kirikkale":       "Kırıkkale",
		"Kirklareli":      "Kırklareli",
		"Kirsehir":        "Kırşehir",
		"Kutahya":         "Kütahya",
		"Mugla":           "Muğla",
		"Mus":             "Muş",
		"Nevsehir":        "Nevşehir",
		"Nigde":           "Niğde",
		"Tekirdag":        "Tekirdağ",
		"Usak":            "Uşak",
	}

	if normalized, ok := alternatives[name]; ok {
		return normalized
	}
	return name
}
