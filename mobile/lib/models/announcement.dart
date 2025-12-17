/// Duyuru modeli - Admin panelinden gelen dinamik icerikler
class Announcement {
  final String id;
  final String title;
  final String content;
  final String? imageUrl;
  final String? linkUrl;
  final String? linkText;
  final String type; // info, warning, success, promotion
  final bool isDismissable;

  Announcement({
    required this.id,
    required this.title,
    required this.content,
    this.imageUrl,
    this.linkUrl,
    this.linkText,
    required this.type,
    required this.isDismissable,
  });

  factory Announcement.fromJson(Map<String, dynamic> json) {
    return Announcement(
      id: json['id'] ?? '',
      title: json['title'] ?? '',
      content: json['content'] ?? '',
      imageUrl: json['image_url'],
      linkUrl: json['link_url'],
      linkText: json['link_text'],
      type: json['type'] ?? 'info',
      isDismissable: json['is_dismissable'] ?? true,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'content': content,
      'image_url': imageUrl,
      'link_url': linkUrl,
      'link_text': linkText,
      'type': type,
      'is_dismissable': isDismissable,
    };
  }
}
